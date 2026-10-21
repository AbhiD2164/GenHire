import os
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
from .skill_extraction import parse_skill_list, extract_present_skills
from .rabbitmq_cache import get_cached_suggestions, compute_runtime_suggestions


class ProcessApplicationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, application_id):
        app = get_object_or_404(Application, id=application_id)

        # only applicant, job owner recruiter, or staff can trigger re-processing
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
    Analyze a resume file (or application) and return ATS score, phishing URL check,
    security evaluation, and improvement suggestions.
    Strictly accepts Word (.docx, .doc) or PDF (.pdf) only.
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

            # Write temporary file to disk for extraction
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

        # Security & Phishing URL Check
        sec_check = verify_candidate_resume_security(file_name, b"", raw)
        if not sec_check["valid"]:
            return Response({
                "valid": False,
                "score": 0.0,
                "score_percentage": 0.0,
                "security_error": sec_check["message"],
                "present_skills": [],
                "tips": [
                    {"missing_required_skills": [], "tip": sec_check["message"]}
                ],
                "status": "rejected",
                "rejection_stage": "rejected_by_system",
                "rejection_reason": sec_check["message"],
            })

        job_skills = []
        if job:
            job_skills = parse_skill_list(job.skills_required) + parse_skill_list(job.good_to_have)

        present_skills = extract_present_skills(raw, job_skills or [])

        tips = []
        if job and job.skills_required:
            missing = [s for s in parse_skill_list(job.skills_required) if s not in present_skills]
            if missing:
                tips.append({"missing_required_skills": missing, "tip": "Add these required skills or concrete projects to your resume."})
        else:
            tips.append({"tip": "Add quantifiable impact and achievements to each work experience entry."})
            tips.append({"tip": "Keep keywords standardized and aligned with target industry roles."})

        # Calculate score (0-1.0 and percentage)
        if job and job.skills_required:
            req = parse_skill_list(job.skills_required)
            score = round(len([s for s in req if s in present_skills]) / max(1, len(req)), 3)
        else:
            score = min(1.0, round(len(present_skills) / 10.0, 2)) if present_skills else 0.75

        score_pct = round(score * 100, 1)

        return Response({
            "valid": True,
            "score": score,
            "score_percentage": score_pct,
            "present_skills": present_skills,
            "tips": tips,
            "status": "selected" if score >= 0.80 else ("applied" if score >= 0.60 else "rejected"),
            "stage_info": "Strong match" if score >= 0.80 else ("Partial match" if score >= 0.60 else "Below threshold (<60%)"),
        })


class RecommendJobsView(APIView):
    """
    Returns runtime suggestions powered by RabbitMQ queue and cache.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        cached = get_cached_suggestions(user.id)
        if cached:
            return Response({"recommendations": cached, "source": "cache"})

        latest_app = Application.objects.filter(applicant=user).order_by("-created_at").first()
        suggestions = compute_runtime_suggestions(
            user=user,
            applied_job=latest_app.job if latest_app else None,
            resume_score=latest_app.score if latest_app else None,
        )
        return Response({"recommendations": suggestions, "source": "computed"})


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
            "headline": profile.headline if hasattr(profile, "headline") else "",
            "location": profile.location,
            "skills": profile.skills,
            "experiences": [
                {"title": e.job_title, "company": e.company, "start": f"{e.start_month or ''}/{e.start_year or ''}", "end": f"{e.end_month or ''}/{e.end_year or ''}"}
                for e in getattr(profile, "experiences", []).all()
            ] if hasattr(profile, "experiences") else [],
        }

        return Response({"auto_resume": resume_json})
