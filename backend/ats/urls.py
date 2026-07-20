from django.urls import path
from . import views

urlpatterns = [
    path("process-application/<int:application_id>/", views.ProcessApplicationView.as_view(), name="ats-process-application"),
    path("resume-analysis/", views.ResumeAnalysisView.as_view(), name="ats-resume-analysis"),
    path("recommend-jobs/", views.RecommendJobsView.as_view(), name="ats-recommend-jobs"),
    path("auto-create-resume/", views.AutoCreateResumeView.as_view(), name="ats-auto-create-resume"),
]
