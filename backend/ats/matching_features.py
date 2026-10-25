import re

from accounts.models import Profile
from .skill_extraction import parse_skill_list, skill_match, normalize_text


EDUCATION_HEADING = re.compile(
    r"^\s*(education|academic background|academic qualifications)\s*:?\s*$",
    re.IGNORECASE,
)
SECTION_HEADING = re.compile(
    r"^\s*(?:work experience|professional experience|employment history|"
    r"experience|skills|projects|certifications|certificates|summary|"
    r"professional summary|objective|achievements|publications|references)"
    r"\s*:?\s*$",
    re.IGNORECASE,
)


def extract_education_text(resume_text):
    lines = (resume_text or "").splitlines()
    start = next((index for index, line in enumerate(lines) if EDUCATION_HEADING.match(line)), None)
    if start is None:
        return ""

    education_lines = []
    for line in lines[start + 1:]:
        if SECTION_HEADING.match(line):
            break
        if line.strip():
            education_lines.append(line.strip())
        if len(" ".join(education_lines)) >= 3000:
            break
    return " ".join(education_lines)[:3000]


def build_profile_features(user):
    try:
        profile = user.profile
    except Profile.DoesNotExist:
        profile = None

    education = []
    experiences = []
    if profile:
        education = list(profile.education.all())
        experiences = list(profile.experiences.all())

    education_text = " ".join(
        " ".join(filter(None, (item.institution, item.degree, item.field_of_study, item.description)))
        for item in education
    )
    experience_text = " ".join(
        " ".join(filter(None, (item.job_title, item.company)))
        for item in experiences
    )
    resume_text = ""
    resume_skills = ""
    resume_education = ""
    parsed = (
        user.applications.filter(parsed_resume__isnull=False)
        .select_related("parsed_resume")
        .order_by("-created_at")
        .first()
    )
    if parsed:
        resume_text = parsed.parsed_resume.raw_text_excerpt
        resume_skills = parsed.parsed_resume.extracted_skills
        resume_education = parsed.parsed_resume.extracted_education

    profile_skills = profile.skills if profile else ""
    skills = list(dict.fromkeys(parse_skill_list(f"{profile_skills}, {resume_skills}")))
    total_experience_months = profile.total_experience_months if profile else 0
    if parsed and parsed.parsed_experience_months:
        total_experience_months = max(total_experience_months, parsed.parsed_experience_months)

    document = " ".join(filter(None, (
        profile.headline if profile else "",
        profile.bio if profile else "",
        profile.industry if profile else "",
        profile_skills,
        resume_skills,
        resume_text,
        resume_education,
        education_text,
        experience_text,
    )))
    return {
        "document": document,
        "skills": skills,
        "education_text": " ".join(filter(None, (education_text, resume_education, resume_text))),
        "experience_months": total_experience_months,
    }


def build_job_features(job, profile_features):
    required_skills = parse_skill_list(job.skills_required)
    preferred_skills = parse_skill_list(job.good_to_have)
    profile_text = normalize_text(
        " ".join((profile_features["document"], *profile_features["skills"]))
    )
    matched_required = [
        skill for skill in required_skills if skill_match(skill, profile_text)
    ]
    matched_preferred = [
        skill for skill in preferred_skills if skill_match(skill, profile_text)
    ]
    required_coverage = len(matched_required) / len(required_skills) if required_skills else 0.0
    preferred_coverage = len(matched_preferred) / len(preferred_skills) if preferred_skills else 0.0

    min_months = job.min_experience_months or 0
    experience_months = profile_features["experience_months"] or 0
    experience_coverage = min(1.0, experience_months / min_months) if min_months else 1.0

    education_requirement = (job.education_requirements or "").strip()
    education_text = normalize_text(profile_features["education_text"])
    education_terms = [
        word for word in re.findall(r"[a-z0-9]+", normalize_text(education_requirement))
        if len(word) > 2
    ]
    education_coverage = (
        sum(1 for term in education_terms if term in education_text) / len(education_terms)
        if education_terms else 0.0
    )

    job_document = " ".join(filter(None, (
        job.title,
        job.description,
        job.skills_required,
        job.good_to_have,
        education_requirement,
        job.industry,
    )))
    pair_document = f"candidate: {profile_features['document']} job: {job_document}"
    numeric_features = [
        required_coverage,
        preferred_coverage,
        experience_coverage,
        min(experience_months / 480.0, 1.0),
        education_coverage,
        1.0 if education_requirement else 0.0,
    ]
    return {
        "document": pair_document,
        "numeric_features": numeric_features,
        "matched_skills": list(dict.fromkeys(matched_required + matched_preferred)),
        "required_skill_coverage": required_coverage,
        "preferred_skill_coverage": preferred_coverage,
        "experience_coverage": experience_coverage,
        "education_coverage": education_coverage,
        "job_document": job_document,
    }
