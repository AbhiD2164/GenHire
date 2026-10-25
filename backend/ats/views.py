import os
import re
import tempfile
from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from jobs.models import Application, Job
from accounts.models import CustomUser
from accounts.verification import verify_candidate_resume_security
from accounts.firebase_service import send_immediate_application_result_email
from .engine import process_resume
from .text_extraction import extract_resume_text
from .skill_extraction import parse_skill_list, extract_present_skills, SKILL_SYNONYMS
from .rabbitmq_cache import compute_runtime_suggestions


INDUSTRY_DOMAINS = {
    "Healthcare & Medicine": [
        "patient care", "nursing", "phlebotomy", "cpr", "emr", "ehr", "triage", "clinical",
        "pharmacology", "pediatrics", "icu", "surgery", "healthcare", "medical records",
    ],
    "Finance & Accounting": [
        "gaap", "bookkeeping", "tally", "financial modeling", "taxation", "auditing", "balance sheet",
        "equity research", "payroll", "portfolio management", "banking", "budgeting", "cpa", "cfa",
    ],
    "Engineering & Manufacturing": [
        "autocad", "solidworks", "cnc machining", "welding", "plc", "six sigma", "quality assurance",
        "electrical wiring", "mechanical", "manufacturing", "lean", "schematics", "bim",
    ],
    "Sales & Marketing": [
        "seo", "crm", "salesforce", "hubspot", "cold calling", "lead generation", "digital marketing",
        "social media marketing", "negotiation", "b2b", "content strategy", "brand management",
    ],
    "Human Resources & Talent": [
        "recruitment", "talent acquisition", "onboarding", "performance management", "labor law",
        "employee engagement", "hris", "workforce planning", "retention",
    ],
    "Information Technology & Software": [
        "python", "javascript", "react", "django", "node.js", "sql", "aws", "cloud", "docker",
        "kubernetes", "cybersecurity", "machine learning", "rest api", "html", "css",
    ],
    "Education & Pedagogy": [
        "lesson planning", "classroom management", "curriculum design", "pedagogy", "tutoring",
        "student assessment", "special education", "academic research",
    ],
    "Legal & Compliance": [
        "contract drafting", "legal research", "litigation", "regulatory compliance", "intellectual property",
        "corporate law", "due diligence", "dispute resolution",
    ],
    "Supply Chain & Logistics": [
        "supply chain management", "inventory management", "logistics", "warehouse management",
        "procurement", "freight", "vendor relations", "distribution",
    ],
}


def detect_resume_industry_and_skills(raw_text):
    text_lower = raw_text.lower()
    matched_by_industry = {}
    total_matched = []

    for domain, keywords in INDUSTRY_DOMAINS.items():
        domain_matches = []
        for kw in keywords:
            if re.search(r"\b" + re.escape(kw) + r"\b", text_lower):
                domain_matches.append(kw)
        if domain_matches:
            matched_by_industry[domain] = domain_matches
            total_matched.extend(domain_matches)

    # Sort industries by match count
    sorted_domains = sorted(matched_by_industry.items(), key=lambda x: len(x[1]), reverse=True)
    detected_industry = sorted_domains[0][0] if sorted_domains else "Professional Services"

    # Detect quantified achievements (numbers, percentages, revenue)
    quantified = re.findall(r"(?:increased|reduced|managed|grew|saved|generated|led|delivered)\s+[^.\n]{0,60}?(?:\d+[%kKmMbB]?|\$\d+|\₹\d+)", raw_text, re.IGNORECASE)

    return detected_industry, matched_by_industry, total_matched, quantified[:4]


class ProcessApplicationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, application_id):
        app = get_object_or_404(Application, id=application_id)

        if request.user != app.applicant and request.user != app.job.created_by and not request.user.is_staff:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        process_resume(app)
        return Response({
            "status": app.status,
            "score": app.score,
            "score_percentage": round(app.score * 100, 1),
            "rejection_stage": app.rejection_stage,
            "rejection_reason": app.rejection_reason,
            "message": app.candidate_message
        })


class ResumeAnalysisView(APIView):
    """
    Comprehensive Cross-Industry Resume Analyzer.
    Trained for all industries (IT, Healthcare, Finance, Manufacturing, Marketing, HR, Legal, etc.).
    Extracts detected skills, detected industry, quantified achievements, generates tailored
    role descriptions, and checks for security/phishing risks.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        application_id = request.data.get("application_id")
        resume_file = request.FILES.get("resume")
        job_id = request.data.get("job_id")

        job = None
        if job_id:
            job = Job.objects.filter(id=job_id).first()

        raw = ""
        file_name = ""

        if application_id:
            app = get_object_or_404(Application, id=application_id)
            raw = extract_resume_text(app.resume.path)
            file_name = os.path.basename(app.resume.path)
        elif resume_file:
            file_name = resume_file.name
            ext = (file_name.rsplit(".", 1)[-1] if "." in file_name else "").lower()
            if ext not in ("pdf", "docx", "doc"):
                return Response(
                    {"detail": f"Unsupported file type (.{ext}). Only PDF and Word (.docx, .doc) files are acceptable."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            suffix = f".{ext}"
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                for chunk in resume_file.chunks():
                    tmp.write(chunk)
                tmp_path = tmp.name

            try:
                raw = extract_resume_text(tmp_path)
            finally:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
        else:
            return Response({"detail": "Please provide application_id or upload resume file."}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Security & Phishing URL Check
        sec_check = verify_candidate_resume_security(file_name, b"", raw)
        if not sec_check["valid"]:
            return Response({
                "valid": False,
                "score": 0.0,
                "score_percentage": 0.0,
                "security_error": sec_check["message"],
                "detected_industry": "Unverified / Security Flagged",
                "present_skills": [],
                "tips": [{"tip": sec_check["message"]}],
                "status": "rejected",
                "rejection_stage": "rejected_by_system",
                "rejection_reason": sec_check["message"],
            })

        # 2. Cross-Industry Domain & Skill Analysis
        detected_industry, matched_by_industry, all_matched_skills, quantified_achievements = detect_resume_industry_and_skills(raw)

        # 3. Job-specific or Global ATS Scoring
        if job and job.skills_required:
            job_skills = parse_skill_list(job.skills_required) + parse_skill_list(job.good_to_have)
            present_skills = extract_present_skills(raw, job_skills)
            req = parse_skill_list(job.skills_required)
            score = round(len([s for s in req if s in present_skills]) / max(1, len(req)), 3)
            missing = [s for s in req if s not in present_skills]
        else:
            present_skills = list(dict.fromkeys(all_matched_skills))
            # Global resume robustness score based on skill density and quantified achievements
            base = min(0.70, len(present_skills) * 0.08)
            quant_bonus = min(0.20, len(quantified_achievements) * 0.05)
            score = round(base + quant_bonus + 0.10, 2)
            missing = []

        score_pct = round(score * 100, 1)

        # 4. Actionable tips
        tips = []
        if missing:
            tips.append(f"Add key target requirements: {', '.join(missing[:5])}.")
        if not quantified_achievements:
            tips.append("Include quantified impact metrics (e.g. 'Grew revenue by 25%', 'Reduced processing latency by 30%').")
        else:
            tips.append(f"Strong measurable accomplishments detected: {len(quantified_achievements)} quantified impacts identified.")
        tips.append(f"Highlight specialized {detected_industry} certifications and domain-specific tool proficiencies.")

        # 5. Tailored Job Description Generation
        sample_jd = (
            f"Opportunity: Senior Specialist ({detected_industry})\n"
            f"Key Requirements: {', '.join(present_skills[:6]) if present_skills else 'Demonstrated professional competency'}.\n"
            f"Scope: Drive high-impact organizational initiatives, collaborate with cross-functional leadership, "
            f"and apply specialized {detected_industry.lower()} domain methodologies to accelerate business results."
        )

        return Response({
            "valid": True,
            "score": score,
            "score_percentage": score_pct,
            "detected_industry": detected_industry,
            "industry_breakdown": matched_by_industry,
            "present_skills": present_skills,
            "quantified_achievements": quantified_achievements,
            "tailored_job_description": sample_jd,
            "tips": [{"tip": t} for t in tips],
            "status": "selected" if score >= 0.80 else ("applied" if score >= 0.60 else "rejected"),
            "stage_info": "Perfect match (80-100%)" if score >= 0.80 else ("Partial match (60-79%)" if score >= 0.60 else "Below threshold (<60%)"),
        })


class RecommendJobsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        suggestions = compute_runtime_suggestions(request.user)
        source = suggestions[0]["recommendation_method"] if suggestions else "none"
        return Response({"recommendations": suggestions, "source": source})


class AutoCreateResumeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        try:
            profile = user.profile
        except Exception:
            return Response({"detail": "Profile missing."}, status=status.HTTP_400_BAD_REQUEST)

        resume_json = {
            "name": user.get_full_name() or user.username,
            "email": user.email,
            "phone_number": user.phone_number,
            "headline": profile.headline if hasattr(profile, "headline") else "",
            "industry": profile.industry if hasattr(profile, "industry") else "",
            "location": profile.location,
            "skills": profile.skills,
            "experiences": [
                {"title": e.job_title, "company": e.company, "start": f"{e.start_month or ''}/{e.start_year or ''}", "end": f"{e.end_month or ''}/{e.end_year or ''}"}
                for e in getattr(profile, "experiences", []).all()
            ] if hasattr(profile, "experiences") else [],
        }

        return Response({"auto_resume": resume_json})
