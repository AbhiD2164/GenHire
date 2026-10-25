from django.db import models


class ParsedResume(models.Model):
    """
    Snapshot of everything the engine extracted from a single resume file,
    kept independently of Application so re-parsing or auditing a decision
    later doesn't require re-reading the file.
    """
    application = models.OneToOneField(
        "jobs.Application", on_delete=models.CASCADE, related_name="parsed_resume"
    )

    raw_text_excerpt = models.TextField(blank=True, help_text="First ~2000 chars of extracted text, for debugging")

    candidate_name_guess = models.CharField(max_length=255, blank=True)
    email_found = models.CharField(max_length=255, blank=True)
    phone_found = models.CharField(max_length=50, blank=True)
    location_found = models.CharField(max_length=255, blank=True)

    extracted_skills = models.TextField(blank=True, help_text="Comma-separated skills found in resume")
    extracted_education = models.TextField(blank=True)
    total_experience_months = models.PositiveIntegerField(default=0)
    experience_segments_json = models.TextField(
        blank=True, help_text="JSON list of {title, company, start, end, months} segments found"
    )

    parse_warnings = models.TextField(blank=True, help_text="Notes about anything the parser couldn't confidently read")

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"ParsedResume<app={self.application_id}>"
