from django.conf import settings
from django.core.mail import send_mail
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from jobs.models import Application, Job
from accounts.models import CustomUser
from .engine import process_resume
from .text_extraction import extract_resume_text
from .skill_extraction import parse_skill_list, extract_present_skills


class ProcessApplicationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, application_id):
        app = get_object_or_404(Application, id=application_id)

        # only applicant or staff can trigger re-processing
        if request.user != app.applicant and not request.user.is_staff:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        process_resume(app)

        # send candidate an email informing about the outcome
        subject = f"Application update for {app.job.title}"
        msg = app.candidate_message + "\n\nThank you for using GenHire."
        send_mail(subject, msg, settings.DEFAULT_FROM_EMAIL, [app.applicant.email], fail_silently=True)

        # if visible to recruiter, notify recruiter with internal feedback
        if app.visible_to_recruiter:
            recruiter_email = app.job.created_by.email
            if recruiter_email:
                rsub = f"New applicant for {app.job.title}"
                rmsg = (
                    f"Candidate: {app.applicant.get_full_name() or app.applicant.username}\n"
                    f"Score: {app.score}\nFeedback: {app.feedback}\n"
                )
                send_mail(rsub, rmsg, settings.DEFAULT_FROM_EMAIL, [recruiter_email], fail_silently=True)

        return Response({"status": app.status, "message": app.candidate_message})


class ResumeAnalysisView(APIView):
    """Analyze a resume file (or application) and return ATS-like breakdown and improvement tips."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        application_id = request.data.get("application_id")
        resume_file = request.FILES.get("resume")
        job_id = request.data.get("job_id")

        job = None
        if job_id:
            job = get_object_or_404(Job, id=job_id)

        if application_id:
            app = get_object_or_404(Application, id=application_id)
            raw = extract_resume_text(app.resume.path)
        elif resume_file:
            # write temp file to disk via InMemoryUploadedFile or TemporaryUploadedFile
            raw = extract_resume_text(resume_file)
        else:
            return Response({"detail": "Provide application_id or upload resume."}, status=status.HTTP_400_BAD_REQUEST)

        if not raw.strip():
            return Response({"detail": "No readable text found in resume."}, status=status.HTTP_400_BAD_REQUEST)

        profile_skills = []
        job_skills = []
        if job:
            job_skills = parse_skill_list(job.skills_required) + parse_skill_list(job.good_to_have)

        present_skills = extract_present_skills(raw, job_skills or [])

        tips = []
        if job and job_skills:
            missing = [s for s in parse_skill_list(job.skills_required) if s not in present_skills]
            if missing:
                tips.append({"missing_required_skills": missing, "tip": "Add these skills or relevant projects to your resume."})

        # simple ATS-like score: fraction of required skills present
        score = None
        if job and job.skills_required:
            req = parse_skill_list(job.skills_required)
            if req:
                score = round(len([s for s in req if s in present_skills]) / len(req), 3)

        return Response({"score": score, "present_skills": present_skills, "tips": tips})


class RecommendJobsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        try:
            profile = user.profile
            user_skills = [s.strip().lower() for s in (profile.skills or "").split(",") if s.strip()]
        except Exception:
            user_skills = []
        # Try ML-based recommender first
        
        from .recommender import Recommender
        rec = Recommender()
        if rec.available():
            results = rec.recommend_for_user(request.user, top_k=30)
            return Response({"recommendations": results})

        # Fallback: simple overlap heuristic
        jobs = Job.objects.filter(is_active=True)

        def score_job(job):
            job_sk = [s.strip().lower() for s in (job.skills_required or "").split(",")]
            if not job_sk:
                return 0
            overlap = len(set(job_sk) & set(user_skills))
            return overlap / max(1, len(job_sk))

        scored = [(score_job(j), j) for j in jobs]
        scored.sort(key=lambda x: x[0], reverse=True)

        results = []
        for sc, j in scored[:30]:
            results.append({"id": j.id, "title": j.title, "company": j.company_name, "score": round(sc, 3)})

        return Response({"recommendations": results})


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
                {"title": e.title, "company": e.company, "start": str(e.start_date), "end": str(e.end_date)}
                for e in getattr(profile, "experiences", []).all()
            ] if hasattr(profile, "experiences") else [],
        }

        return Response({"auto_resume": resume_json})
