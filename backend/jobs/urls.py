from django.urls import path
from .views import (
    JobListCreateView, JobDetailView, ApplyToJobView,
    MyApplicationsView, JobApplicationsView, RecruiterDashboardView,
    RecruiterApplicationDecisionView, RuntimeSuggestionsView,
)

urlpatterns = [
    path("", JobListCreateView.as_view(), name="job_list_create"),
    path("<int:pk>/", JobDetailView.as_view(), name="job_detail"),
    path("<int:job_id>/apply/", ApplyToJobView.as_view(), name="apply_job"),
    path("<int:job_id>/applications/", JobApplicationsView.as_view(), name="job_applications"),
    path("applications/<int:application_id>/decision/", RecruiterApplicationDecisionView.as_view(), name="application_decision"),
    path("my-applications/", MyApplicationsView.as_view(), name="my_applications"),
    path("recruiter/dashboard/", RecruiterDashboardView.as_view(), name="recruiter_dashboard"),
    path("runtime-suggestions/", RuntimeSuggestionsView.as_view(), name="runtime_suggestions"),
]
