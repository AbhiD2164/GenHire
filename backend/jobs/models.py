from django.db import models
from django.conf import settings

JOB_TYPE_CHOICES = (
    ("full_time", "Full-time"),
    ("part_time", "Part-time"),
    ("contract", "Contract"),
    ("internship", "Internship"),
    ("freelance", "Freelance"),
)

WORK_MODE_CHOICES = (
    ("onsite", "On-site"),
    ("remote", "Remote"),
    ("hybrid", "Hybrid"),
)

# Industry is free-form-friendly but offers common buckets for filtering.
INDUSTRY_CHOICES = (
    ("information_technology", "Information Technology"),
    ("healthcare", "Healthcare"),
    ("finance", "Finance & Accounting"),
    ("education", "Education"),
    ("sales_marketing", "Sales & Marketing"),
    ("design_creative", "Design & Creative"),
    ("operations_logistics", "Operations & Logistics"),
    ("human_resources", "Human Resources"),
    ("legal", "Legal"),
    ("manufacturing", "Manufacturing & Engineering"),
    ("hospitality", "Hospitality & Travel"),
    ("construction", "Construction & Real Estate"),
    ("retail", "Retail & Customer Service"),
    ("media", "Media & Communications"),
    ("science_research", "Science & Research"),
    ("other", "Other"),
)


class Job(models.Model):
    title = models.CharField(max_length=255)
    company_name = models.CharField(max_length=255, blank=True)
    industry = models.CharField(max_length=50, choices=INDUSTRY_CHOICES, default="other")
    job_type = models.CharField(max_length=20, choices=JOB_TYPE_CHOICES, default="full_time")
    work_mode = models.CharField(max_length=20, choices=WORK_MODE_CHOICES, default="onsite")

    location = models.CharField(max_length=255, blank=True, help_text="City, State/Country, or 'Remote'")

    description = models.TextField()

    # Experience requirement, stored as a min/max range in months so the
    # parser's extracted candidate experience can be compared numerically.
    min_experience_months = models.PositiveIntegerField(default=0)
    max_experience_months = models.PositiveIntegerField(null=True, blank=True)

    skills_required = models.TextField(help_text="Comma-separated required skills/keywords, any domain")
    good_to_have = models.TextField(blank=True, help_text="Comma-separated optional skills/keywords")

    salary_min = models.PositiveIntegerField(null=True, blank=True)
    salary_max = models.PositiveIntegerField(null=True, blank=True)

    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="jobs_posted")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title

    @property
    def required_experience_label(self):
        min_y = round(self.min_experience_months / 12, 1)
        if self.max_experience_months:
            max_y = round(self.max_experience_months / 12, 1)
            return f"{min_y}-{max_y} years"
        return f"{min_y}+ years"


class Application(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("selected", "Selected"),
        ("consider", "Consider"),
        ("rejected", "Rejected"),  # hard-gated: never surfaced to recruiter
    )

    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="applications")
    applicant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="applications")
    resume = models.FileField(upload_to="applications/")

    parsed_location = models.CharField(max_length=255, blank=True)
    parsed_experience_months = models.PositiveIntegerField(null=True, blank=True)
    parsed_skills = models.TextField(blank=True)

    score = models.FloatField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    feedback = models.TextField(blank=True, help_text="Internal feedback shown to recruiter")
    candidate_message = models.CharField(max_length=255, blank=True, help_text="Message shown to the candidate")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-score", "-created_at"]
        unique_together = ("job", "applicant")

    def __str__(self):
        return f"{self.applicant} - {self.job.title} ({self.status})"

    @property
    def visible_to_recruiter(self):
        return self.status in ("selected", "consider")
