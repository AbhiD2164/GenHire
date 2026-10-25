"""
Main ATS engine entry point with security validation, format verification,
scoring, instant email notification, and RabbitMQ suggestion caching.
"""
import json
import os
from django.conf import settings
from django.utils import timezone

from .text_extraction import extract_resume_text
from .location_extraction import extract_location
from .experience_extraction import extract_experience_segments, months_to_label
from .matching_features import extract_education_text
from .skill_extraction import (
    normalize_text,
    parse_skill_list,
    skill_match,
    extract_present_skills,
    tokenized_relevance_score,
    SKILL_SYNONYMS,
)
from accounts.verification import verify_candidate_resume_security
from accounts.firebase_service import send_immediate_application_result_email
from .rabbitmq_cache import compute_runtime_suggestions


SUCCESS_MESSAGE = "Your application is submitted successfully!"
PARTIAL_MESSAGE = "Your application is under recruiter review (Partial match)."
REJECT_SYSTEM_MESSAGE = "Application rejected by system: resume score or format does not meet threshold."


def process_resume(application):
    """
    Runs the full ATS evaluation pipeline for an Application instance:
    1. Validates file extension (PDF or DOCX only).
    2. Extracts text and validates format standards and phishing URL checks.
    3. Calculates ATS resume score (0 - 100%).
    4. Categorizes into status ('applied', 'selected', 'rejected').
    5. Dispatches instant email notification to candidate with score and reason.
    6. Triggers RabbitMQ event and updates runtime suggestions cache.
    """
    from .models import ParsedResume

    job = application.job
    file_path = application.resume.path
    file_name = os.path.basename(file_path)

    # 1. Format & File Type check
    ext = (file_name.rsplit(".", 1)[-1] if "." in file_name else "").lower()
    if ext not in ("pdf", "docx", "doc"):
        application.status = "rejected"
        application.rejection_stage = "rejected_by_system"
        application.rejection_reason = f"Unsupported file type (.{ext}). Only PDF (.pdf) and Word (.docx, .doc) files are acceptable."
        application.score = 0.0
        application.candidate_message = "Application rejected: Only Word (.docx) and PDF (.pdf) files are acceptable."
        application.save()
        send_immediate_application_result_email(application)
        return application

    # Extract raw text
    raw_text = extract_resume_text(file_path)
    extracted_education = extract_education_text(raw_text)

    # 2. Security & Phishing URL & Unstructured Format Validation
    sec_check = verify_candidate_resume_security(file_name, b"", raw_text)
    if not sec_check["valid"]:
        application.status = "rejected"
        application.rejection_stage = "rejected_by_system"
        application.rejection_reason = sec_check["message"]
        application.score = 0.0
        application.feedback = sec_check["message"]
        application.candidate_message = f"Application rejected by system: {sec_check['message']}"
        application.save()

        ParsedResume.objects.update_or_create(
            application=application,
            defaults={
                "raw_text_excerpt": raw_text[:2000] if raw_text else "",
                "extracted_education": extracted_education,
                "parse_warnings": sec_check["message"],
            },
        )
        send_immediate_application_result_email(application)
        # Runtime suggestions for applicant based on profile
        compute_runtime_suggestions(application.applicant)
        return application

    # 3. Location extraction
    location_found = extract_location(raw_text)

    # 4. Work Experience extraction
    segments, total_months = extract_experience_segments(raw_text)

    # 5. Skills extraction
    required_skills = parse_skill_list(job.skills_required)
    good_skills = parse_skill_list(job.good_to_have)
    full_universe = list(dict.fromkeys([*SKILL_SYNONYMS, *required_skills, *good_skills]))

    found_skills = extract_present_skills(raw_text, full_universe)
    found_set = set(found_skills)
    normalized_resume = normalize_text(raw_text)

    # Scoring
    skill_points = 0
    missing_required = []
    for skill in required_skills:
        if skill in found_set or skill_match(skill, normalized_resume):
            skill_points += 2
        else:
            missing_required.append(skill)

    for skill in good_skills:
        if skill in found_set or skill_match(skill, normalized_resume):
            skill_points += 1

    skill_total_possible = len(required_skills) * 2 + len(good_skills)
    skill_score = (skill_points / skill_total_possible) if skill_total_possible else 1.0

    exp_score = _experience_fit_score(
        candidate_months=total_months,
        min_months=job.min_experience_months,
        max_months=job.max_experience_months,
    )

    token_score = tokenized_relevance_score(
        raw_text,
        " ".join(filter(None, [job.title, job.description, job.skills_required, job.good_to_have])),
    )

    final_score = round((skill_score * 0.6) + (exp_score * 0.25) + (token_score * 0.15), 3)
    score_percentage = round(final_score * 100, 1)

    # 6. Evaluation thresholds:
    # 80-100%: Perfect match -> Selected
    # 60-79%: Partial match -> Applied / Under review
    # <60%: Rejected by system
    perfect_thresh = getattr(settings, "ATS_PERFECT_THRESHOLD", 0.80)
    partial_thresh = getattr(settings, "ATS_PARTIAL_THRESHOLD", 0.60)

    rejection_stage = ""
    rejection_reason = ""

    if final_score >= perfect_thresh:
        status = "selected"
        feedback = f"Perfect match ({score_percentage}%). Strong skills and experience alignment."
        candidate_msg = f"Your application is selected! Strong match ({score_percentage}%)."
    elif final_score >= partial_thresh:
        status = "applied"
        missing_note = f" Missing required: {', '.join(missing_required)}." if missing_required else ""
        feedback = f"Partial match ({score_percentage}%).{missing_note}"
        candidate_msg = f"Your application is received and in review. Partial match ({score_percentage}%)."
    else:
        status = "rejected"
        rejection_stage = "rejected_by_system"
        missing_note = f"Missing required skills: {', '.join(missing_required)}." if missing_required else ""
        exp_note = ""
        if job.min_experience_months and total_months < job.min_experience_months:
            exp_note = f" Experience ({months_to_label(total_months)}) below required minimum ({months_to_label(job.min_experience_months)})."
        rejection_reason = f"Resume score ({score_percentage}%) did not meet minimum threshold (60%). {missing_note}{exp_note}".strip()
        feedback = f"Insufficient match ({score_percentage}%). {rejection_reason}"
        candidate_msg = f"Application rejected by system: resume score ({score_percentage}%) below requirement."

    # Persist application results
    application.parsed_location = location_found
    application.parsed_experience_months = total_months
    application.parsed_skills = ", ".join(found_skills)
    application.score = final_score
    application.status = status
    application.rejection_stage = rejection_stage
    application.rejection_reason = rejection_reason
    application.feedback = feedback
    application.candidate_message = candidate_msg
    application.save()

    ParsedResume.objects.update_or_create(
        application=application,
        defaults={
            "raw_text_excerpt": raw_text[:2000],
            "candidate_name_guess": _guess_name(raw_text),
            "email_found": _find_email(raw_text),
            "phone_found": _find_phone(raw_text),
            "location_found": location_found,
            "extracted_skills": ", ".join(found_skills),
            "extracted_education": extracted_education,
            "total_experience_months": total_months,
            "experience_segments_json": json.dumps(segments),
            "parse_warnings": "" if segments else "No clear date ranges found in work history.",
        },
    )

    # Sync candidate profile with real extracted data
    _sync_profile(application.applicant, location_found, total_months, found_skills)

    # 7. Disseminate result immediately via email to eliminate communication delay
    send_immediate_application_result_email(application)

    # 8. Trigger RabbitMQ runtime suggestions
    compute_runtime_suggestions(application.applicant)

    return application


def _experience_fit_score(candidate_months, min_months, max_months):
    if not min_months:
        return 1.0
    if candidate_months >= min_months:
        return 1.0
    if min_months == 0:
        return 1.0
    return max(0.0, candidate_months / min_months)


def _guess_name(text):
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        words = line.split()
        if 1 < len(words) <= 4 and all(w[0].isupper() for w in words if w[:1].isalpha()):
            if not any(ch.isdigit() for ch in line) and "@" not in line:
                return line
        break
    return ""


def _find_email(text):
    import re
    m = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", text)
    return m.group(0) if m else ""


def _find_phone(text):
    import re
    m = re.search(r"(\+?\d{1,3}[\s-]?)?\d{10}", text)
    return m.group(0) if m else ""


def _sync_profile(user, location, total_months, found_skills):
    try:
        profile = user.profile
    except Exception:
        return

    if location and not profile.location:
        profile.location = location

    if total_months:
        profile.total_experience_months = max(profile.total_experience_months, total_months)

    if found_skills:
        existing = set(parse_skill_list(profile.skills))
        merged = existing.union(found_skills)
        profile.skills = ", ".join(sorted(merged))

    profile.save()
