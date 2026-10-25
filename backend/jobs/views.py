from django.db.models import Q
from rest_framework import generics, permissions, status, filters
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import Job, Application
from .serializers import (
    JobSerializer, JobWriteSerializer, ApplicationSerializer, ApplicationCandidateView,
)
from ats.engine import process_resume
from ats.rabbitmq_cache import compute_runtime_suggestions
from accounts.firebase_service import send_immediate_application_result_email
from network.models import Notification


class JobListCreateView(generics.ListCreateAPIView):
    """
    GET: searchable/filterable job feed.
    POST: creates a job posting for ANY company/industry.
    """
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ["title", "company_name", "description", "skills_required", "location"]

    def get_queryset(self):
        qs = Job.objects.filter(is_active=True).select_related("created_by")

        industry = self.request.query_params.get("industry")
        job_type = self.request.query_params.get("job_type")
        work_mode = self.request.query_params.get("work_mode")
        location = self.request.query_params.get("location")
        min_exp_years = self.request.query_params.get("min_experience_years")
        mine = self.request.query_params.get("mine")

        if industry:
            qs = qs.filter(industry=industry)
        if job_type:
            qs = qs.filter(job_type=job_type)
        if work_mode:
            qs = qs.filter(work_mode=work_mode)
        if location:
            qs = qs.filter(location__icontains=location)
        if min_exp_years:
            try:
                months = round(float(min_exp_years) * 12)
                qs = qs.filter(min_experience_months__lte=months)
            except ValueError:
                pass
        if mine == "true":
            qs = qs.filter(created_by=self.request.user)

        return qs

    def get_serializer_class(self):
        return JobWriteSerializer if self.request.method == "POST" else JobSerializer

    def perform_create(self, serializer):
        serializer.save()

    def get_serializer_context(self):
        return {"request": self.request}


class JobDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Job.objects.all()
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        return JobWriteSerializer if self.request.method in ("PUT", "PATCH") else JobSerializer

    def get_serializer_context(self):
        return {"request": self.request}

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if request.method in ("PUT", "PATCH", "DELETE") and obj.created_by_id != request.user.id:
            raise PermissionDenied("You can only modify jobs you posted.")


class ApplyToJobView(APIView):
    """
    User applies with a resume file.
    Validates file format (strictly PDF or Word .docx/.doc only).
    Runs automated ATS evaluation, checks phishing URLs and unstructured format,
    calculates score, sends immediate result email to candidate, and triggers
    RabbitMQ runtime job suggestions.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, job_id):
        try:
            job = Job.objects.get(id=job_id, is_active=True)
        except Job.DoesNotExist:
            return Response({"detail": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

        if job.created_by_id == request.user.id:
            return Response({"detail": "You cannot apply to a job that you posted."}, status=status.HTTP_400_BAD_REQUEST)

        if Application.objects.filter(job=job, applicant=request.user).exists():
            return Response({"detail": "You have already applied to this job."}, status=status.HTTP_400_BAD_REQUEST)

        resume = request.FILES.get("resume")
        if not resume:
            return Response({"detail": "Please upload your resume to apply."}, status=status.HTTP_400_BAD_REQUEST)

        max_mb = 5
        if resume.size > max_mb * 1024 * 1024:
            return Response({"detail": f"Resume file is too large (max {max_mb}MB)."}, status=status.HTTP_400_BAD_REQUEST)

        ext = resume.name.lower().rsplit(".", 1)[-1] if "." in resume.name else ""
        if ext not in ("pdf", "docx", "doc"):
            return Response(
                {"detail": f"Invalid file format (.{ext}). Only PDF and Word (.docx, .doc) files are acceptable."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        application = Application.objects.create(job=job, applicant=request.user, resume=resume)
        Notification.objects.create(
            recipient=job.created_by,
            actor=request.user,
            notification_type="job_application",
            title="New job application",
            body=f"{request.user.get_full_name() or request.user.username} applied for {job.title}.",
            target_url=f"/jobs/{job.id}/applications",
        )

        # Process resume, perform security check, score and email immediately
        process_resume(application)
        if application.status != "applied":
            Notification.objects.create(
                recipient=application.applicant,
                actor=job.created_by,
                notification_type="application_update",
                title="Your application status changed",
                body=f"Your application for {job.title} is now {application.get_status_display().lower()}.",
                target_url="/dashboard",
            )

        return Response(
            ApplicationCandidateView(application).data,
            status=status.HTTP_201_CREATED,
        )


class MyApplicationsView(generics.ListAPIView):
    """
    User's own application history with real-time status and scoring.
    Supports filtering by status: 'applied', 'selected', 'rejected'.
    """
    serializer_class = ApplicationCandidateView
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Application.objects.filter(applicant=self.request.user).select_related("job")
        status_filter = self.request.query_params.get("status")
        if status_filter in ("applied", "selected", "rejected"):
            qs = qs.filter(status=status_filter)
        return qs.order_by("-created_at")


class ApplicationStatsView(APIView):
    """
    Returns a breakdown of the current user's application statistics:
    - total submitted
    - auto-rejected by system (skills mismatch / format failure)
    - rejected by recruiter (human decision)
    - selected / shortlisted
    - currently in review
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = Application.objects.filter(applicant=request.user)
        total = qs.count()
        auto_rejected = qs.filter(
            status="rejected",
            rejection_stage="rejected_by_system"
        ).count()
        recruiter_rejected = qs.filter(
            status="rejected",
            rejection_stage="rejected_by_recruiter"
        ).count()
        selected = qs.filter(status="selected").count()
        in_review = qs.filter(status__in=["applied", "consider"]).count()

        return Response({
            "total": total,
            "in_review": in_review,
            "selected": selected,
            "rejected_total": auto_rejected + recruiter_rejected,
            "auto_rejected_by_system": auto_rejected,
            "rejected_by_recruiter": recruiter_rejected,
        })


class JobApplicationsView(generics.ListAPIView):
    """
    Recruiter view of applicants for a job posted by the recruiter.
    """
    serializer_class = ApplicationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        job_id = self.kwargs["job_id"]
        job = Job.objects.filter(id=job_id, created_by=self.request.user).first()
        if not job:
            raise PermissionDenied("You can only view applications for jobs you posted.")

        qs = Application.objects.filter(job=job).select_related("applicant", "job")
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs.order_by("-score", "-created_at")


class JobApplicationDecisionView(APIView):
    """
    Allows a job owner to select or reject an application with a custom reason.
    Immediately updates application status and sends result email to candidate
    to eliminate communication delays.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, application_id):
        application = Application.objects.select_related("job", "applicant").filter(id=application_id).first()
        if not application:
            return Response({"detail": "Application not found."}, status=status.HTTP_404_NOT_FOUND)

        if application.job.created_by_id != request.user.id and not request.user.is_staff:
            raise PermissionDenied("You can only manage applications for jobs you posted.")

        action = request.data.get("action", "").lower()
        reason = request.data.get("reason", "").strip()

        if action == "select":
            application.status = "selected"
            application.feedback = f"Selected by job owner: {reason or 'Strong qualifications'}"
            application.candidate_message = f"Congratulations! You were selected by the hiring team at {application.job.company_name}."
            application.rejection_stage = ""
            application.rejection_reason = ""
        elif action == "reject":
            application.status = "rejected"
            application.rejection_stage = "rejected_by_recruiter"
            application.rejection_reason = reason or "Better skills in other candidates were found"
            application.feedback = f"Rejected by job owner: {application.rejection_reason}"
            application.candidate_message = f"Application update: {application.rejection_reason}."
        else:
            return Response({"detail": "Invalid action. Choose 'select' or 'reject'."}, status=status.HTTP_400_BAD_REQUEST)

        application.human_reviewed = True
        application.save()
        Notification.objects.create(
            recipient=application.applicant,
            actor=request.user,
            notification_type="application_update",
            title="Your application was updated",
            body=f"Your application for {application.job.title} is now {application.get_status_display().lower()}.",
            target_url="/dashboard",
        )

        # Send immediate email notification to candidate
        send_immediate_application_result_email(application)

        return Response(ApplicationSerializer(application).data)


class ApplicationInvitationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, application_id):
        application = Application.objects.select_related("job", "applicant").filter(
            id=application_id
        ).first()
        if not application:
            return Response(
                {"detail": "Application not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if application.job.created_by_id != request.user.id and not request.user.is_staff:
            raise PermissionDenied("You can only invite applicants to jobs you posted.")

        invitation_type = request.data.get("type")
        if invitation_type not in ("interview", "assessment"):
            return Response(
                {"detail": "type must be 'interview' or 'assessment'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        kind = "interview_invite" if invitation_type == "interview" else "assessment_invite"
        title = "Interview invitation" if invitation_type == "interview" else "Assessment invitation"
        message = str(request.data.get("message", "")).strip()
        if not message:
            return Response(
                {"detail": "Please include the interview or assessment details."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(message) > 1500:
            return Response(
                {"detail": "Invitation details must be 1500 characters or fewer."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        notification = Notification.objects.create(
            recipient=application.applicant,
            actor=request.user,
            notification_type=kind,
            title=title,
            body=f"{application.job.title}: {message}",
            target_url="/dashboard",
        )
        return Response(
            {"id": notification.id, "title": title, "body": notification.body},
            status=status.HTTP_201_CREATED,
        )


class MyPostedJobsView(APIView):
    """Returns all jobs posted by the current user."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        jobs = Job.objects.filter(created_by=request.user)
        data = JobSerializer(jobs, many=True, context={"request": request}).data
        return Response(data)


class RuntimeSuggestionsView(APIView):
    """
    Returns runtime job suggestions powered by RabbitMQ suggestion queue and cache.
    - If user has a matching resume: suggests roles similar to their profile/applied role.
    - If user does not have a matching resume: suggests roles directly matching their extracted resume skills.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        suggestions = compute_runtime_suggestions(request.user)
        source = suggestions[0]["recommendation_method"] if suggestions else "none"
        return Response({"suggestions": suggestions, "source": source})
