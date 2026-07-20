from django.contrib import admin
from .models import ParsedResume


@admin.register(ParsedResume)
class ParsedResumeAdmin(admin.ModelAdmin):
    list_display = ("application", "location_found", "total_experience_months", "created_at")
    search_fields = ("extracted_skills", "location_found", "candidate_name_guess")
