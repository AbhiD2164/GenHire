from django.contrib import admin
from .models import Job, Application


@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ("title", "company_name", "industry", "created_by", "is_active", "created_at")
    list_filter = ("industry", "job_type", "work_mode", "is_active")
    search_fields = ("title", "company_name", "skills_required")


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ("applicant", "job", "status", "score", "parsed_experience_months", "created_at")
    list_filter = ("status",)
    search_fields = ("applicant__username", "job__title", "parsed_skills")
