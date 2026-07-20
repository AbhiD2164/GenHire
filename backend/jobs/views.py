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


class IsRecruiter(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "recruiter"


class JobListCreateView(generics.ListCreateAPIView):
    """
    GET: searchable/filterable job feed — open to applicants and recruiters.
    POST: recruiters only, creates a job posting for ANY industry.
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
        if self.request.user.role != "recruiter":
            raise PermissionDenied("Only recruiters can post jobs.")
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
    Candidate applies with a resume file. The resume is parsed immediately
    and the hard-gate decision is made synchronously, so the response the
    candidate gets back already reflects the final outcome message —
    either the success message or the generic not-suitable message. The
    candidate response NEVER includes the score or missing-skills detail.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, job_id):
        if request.user.role != "applicant":
            raise PermissionDenied("Only applicants can apply to jobs.")

        try:
            job = Job.objects.get(id=job_id, is_active=True)
        except Job.DoesNotExist:
            return Response({"detail": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

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
            return Response({"detail": "Resume must be a PDF or Word (.docx) file."}, status=status.HTTP_400_BAD_REQUEST)

        application = Application.objects.create(job=job, applicant=request.user, resume=resume)

        process_resume(application)

        return Response(
            ApplicationCandidateView(application).data,
            status=status.HTTP_201_CREATED,
        )


class MyApplicationsView(generics.ListAPIView):
    """Candidate's own application history — gated message only."""
    serializer_class = ApplicationCandidateView
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Application.objects.filter(applicant=self.request.user).select_related("job")


class JobApplicationsView(generics.ListAPIView):
    """
    Recruiter view of applicants for one of their jobs. This is the hard
    gate enforcement point: only applications with status in
    (selected, consider) are ever returned here — rejected applications
    are excluded entirely, not just hidden in the UI.
    """
    serializer_class = ApplicationSerializer
    permission_classes = [permissions.IsAuthenticated, IsRecruiter]

    def get_queryset(self):
        job_id = self.kwargs["job_id"]
        job = Job.objects.filter(id=job_id, created_by=self.request.user).first()
        if not job:
            raise PermissionDenied("You can only view applications for jobs you posted.")

        status_filter = self.request.query_params.get("status")
        qs = Application.objects.filter(job=job, status__in=["selected", "consider"]).select_related("applicant", "job")
        if status_filter in ("selected", "consider"):
            qs = qs.filter(status=status_filter)
        return qs.order_by("-score")


class RecruiterDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsRecruiter]

    def get(self, request):
        jobs = Job.objects.filter(created_by=request.user)
        data = JobSerializer(jobs, many=True, context={"request": request}).data
        return Response(data)
