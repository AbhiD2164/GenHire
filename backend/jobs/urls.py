from django.urls import path
from .views import (
    JobListCreateView, JobDetailView, ApplyToJobView,
    MyApplicationsView, JobApplicationsView, RecruiterDashboardView,
)

urlpatterns = [
    path("", JobListCreateView.as_view(), name="job_list_create"),
    path("<int:pk>/", JobDetailView.as_view(), name="job_detail"),
    path("<int:job_id>/apply/", ApplyToJobView.as_view(), name="apply_job"),
    path("<int:job_id>/applications/", JobApplicationsView.as_view(), name="job_applications"),
    path("my-applications/", MyApplicationsView.as_view(), name="my_applications"),
    path("recruiter/dashboard/", RecruiterDashboardView.as_view(), name="recruiter_dashboard"),
]
