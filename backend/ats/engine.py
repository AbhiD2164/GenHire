"""
Main ATS engine entry point.

process_resume(application) is the single function the rest of the app
calls. It:
  1. Extracts raw text from the uploaded resume (PDF/DOCX/fallback).
  2. Extracts location, structured work-experience segments + total months,
     and the subset of the job's required/good-to-have skills present.
  3. Scores the candidate against the job's requirements.
  4. Applies the HARD GATE decision:
       - score >= SELECT_THRESHOLD              -> "selected"
       - CONSIDER_THRESHOLD <= score < SELECT    -> "consider"
       - score < CONSIDER_THRESHOLD              -> "rejected"
     Only "selected" and "consider" applications are ever visible to the
     recruiter (see Application.visible_to_recruiter / jobs/views.py).
     "rejected" applications still exist in the DB for the candidate's own
     dashboard and basic anti-spam/audit purposes, but a recruiter querying
     the applicant list for a job will never see them.
  5. Sets Application.candidate_message — the only thing the candidate is
     shown — to either a success message or a generic "not suitable"
     message. The candidate is never shown their score or which skills are
     missing, to avoid an adversarial "tune your resume to game the score"
     dynamic; recruiters get the detailed breakdown instead.
"""
import json

from django.conf import settings
from django.utils import timezone

from .text_extraction import extract_resume_text
from .location_extraction import extract_location
from .experience_extraction import extract_experience_segments, months_to_label
from .skill_extraction import (
    normalize_text,
    parse_skill_list,
    skill_match,
    extract_present_skills,
)


SUCCESS_MESSAGE = "Your application is sent successfully!"
REJECT_MESSAGE = "Oops! Your application is not suitable for this job role."


def process_resume(application):
    """
    Runs the full pipeline for a single Application instance, mutating and
    saving it (and a linked ParsedResume record) with the outcome.
    """
    from .models import ParsedResume  # local import avoids circular import at app load

    job = application.job

    file_path = application.resume.path
    raw_text = extract_resume_text(file_path)

    if not raw_text.strip():
        application.status = "rejected"
        application.score = 0
        application.feedback = "Could not extract any readable text from the uploaded resume."
        application.candidate_message = REJECT_MESSAGE
        application.save()
        ParsedResume.objects.update_or_create(
            application=application,
            defaults={
                "raw_text_excerpt": "",
                "parse_warnings": "No text could be extracted from this file.",
            },
        )
        return application

    # ---------- Location ----------
    location_found = extract_location(raw_text)

    # ---------- Experience ----------
    segments, total_months = extract_experience_segments(raw_text)

    # ---------- Skills ----------
    required_skills = parse_skill_list(job.skills_required)
    good_skills = parse_skill_list(job.good_to_have)
    full_universe = list(dict.fromkeys(required_skills + good_skills))  # dedupe, keep order

    found_skills = extract_present_skills(raw_text, full_universe)
    found_set = set(found_skills)

    normalized_resume = normalize_text(raw_text)

    # ---------- Scoring ----------
    # Skill component: required skills weighted 2x, good-to-have 1x.
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

    # Experience component: how well candidate's total experience fits the
    # job's [min, max] requirement window. Meeting/exceeding min is full
    # credit; being under min is partial credit proportional to how close
    # they are; there's no penalty for exceeding max (overqualified is
    # still a fit), capped at full credit.
    exp_score = _experience_fit_score(
        candidate_months=total_months,
        min_months=job.min_experience_months,
        max_months=job.max_experience_months,
    )

    # Final weighted score: skills matter more than the experience band,
    # but both contribute, mirroring how a human recruiter would screen.
    final_score = round((skill_score * 0.7) + (exp_score * 0.3), 3)

    # ---------- Hard-gate decision ----------
    select_threshold = getattr(settings, "ATS_SELECT_THRESHOLD", 0.70)
    consider_threshold = getattr(settings, "ATS_CONSIDER_THRESHOLD", 0.40)

    if final_score >= select_threshold:
        status = "selected"
        feedback = "Strong match for the role."
    elif final_score >= consider_threshold:
        status = "consider"
        missing_note = f" Missing required: {', '.join(missing_required)}." if missing_required else ""
        feedback = f"Partial match.{missing_note}"
    else:
        status = "rejected"
        missing_note = f" Missing required: {', '.join(missing_required)}." if missing_required else ""
        exp_note = ""
        if job.min_experience_months and total_months < job.min_experience_months:
            exp_note = (
                f" Candidate experience ({months_to_label(total_months)}) is below the "
                f"required minimum ({months_to_label(job.min_experience_months)})."
            )
        feedback = f"Insufficient match.{missing_note}{exp_note}"

    # ---------- Persist ----------
    application.parsed_location = location_found
    application.parsed_experience_months = total_months
    application.parsed_skills = ", ".join(found_skills)
    application.score = final_score
    application.status = status
    application.feedback = feedback
    application.candidate_message = SUCCESS_MESSAGE if status in ("selected", "consider") else REJECT_MESSAGE
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
            "total_experience_months": total_months,
            "experience_segments_json": json.dumps(segments),
            "parse_warnings": "" if segments else "No clear date ranges found in work history.",
        },
    )

    # Keep the applicant's profile reasonably in sync with their latest
    # parsed resume, so their public profile reflects real data without
    # requiring manual re-entry.
    _sync_profile(application.applicant, location_found, total_months, found_skills)

    return application


def _experience_fit_score(candidate_months, min_months, max_months):
    if not min_months:
        return 1.0  # job has no stated minimum -> experience isn't a gating factor

    if candidate_months >= min_months:
        return 1.0

    if min_months == 0:
        return 1.0

    # Linear partial credit for being under the minimum, floored at 0.
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
        break  # only consider the very first non-empty line
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

    profile.total_experience_months = max(profile.total_experience_months, total_months)

    if found_skills:
        existing = set(parse_skill_list(profile.skills))
        merged = existing.union(found_skills)
        profile.skills = ", ".join(sorted(merged))

    profile.save()
