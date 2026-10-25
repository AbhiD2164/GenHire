from django.urls import path
from .views import (
    JobListCreateView, JobDetailView, ApplyToJobView,
    MyApplicationsView, ApplicationStatsView, JobApplicationsView, MyPostedJobsView,
    JobApplicationDecisionView, ApplicationInvitationView, RuntimeSuggestionsView,
)

urlpatterns = [
    path("", JobListCreateView.as_view(), name="job_list_create"),
    path("<int:pk>/", JobDetailView.as_view(), name="job_detail"),
    path("<int:job_id>/apply/", ApplyToJobView.as_view(), name="apply_job"),
    path("<int:job_id>/applications/", JobApplicationsView.as_view(), name="job_applications"),
    path("applications/<int:application_id>/decision/", JobApplicationDecisionView.as_view(), name="application_decision"),
    path("applications/<int:application_id>/invite/", ApplicationInvitationView.as_view(), name="application_invitation"),
    path("my-applications/", MyApplicationsView.as_view(), name="my_applications"),
    path("my-applications/stats/", ApplicationStatsView.as_view(), name="application_stats"),
    path("my-posted-jobs/", MyPostedJobsView.as_view(), name="my_posted_jobs"),
    path("recruiter/dashboard/", MyPostedJobsView.as_view(), name="my_posted_jobs_compat"),
    path("runtime-suggestions/", RuntimeSuggestionsView.as_view(), name="runtime_suggestions"),
]
