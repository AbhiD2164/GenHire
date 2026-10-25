from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class CustomUser(AbstractUser):
    email = models.EmailField(unique=True)
    legacy_role = models.CharField(max_length=20, blank=True, default="")
    email_verified = models.BooleanField(default=False)
    phone_number = models.CharField(max_length=30, blank=True)

    company_name = models.CharField(max_length=255, blank=True)
    company_website = models.CharField(max_length=255, blank=True)
    legacy_is_recruiter_verified = models.BooleanField(default=False)
    legacy_recruiter_verification_notes = models.TextField(blank=True)
    legacy_is_candidate_verified = models.BooleanField(default=False)
    legacy_candidate_verification_notes = models.TextField(blank=True)

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = ["email"]

    def __str__(self):
        return self.get_full_name() or self.username


class EmailVerificationCode(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="verification_codes")
    code_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def is_valid(self):
        return self.attempts < 5 and timezone.now() < self.expires_at


class Profile(models.Model):
    """
    Extended, role-agnostic profile. Works for any industry/role, not just IT.
    `skills` and `total_experience_months` are kept in sync with the most
    recently parsed resume, but a user can also edit them manually.
    """
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name="profile")

    headline = models.CharField(max_length=255, blank=True, help_text="e.g. 'Senior Marketing Manager' or 'Civil Engineer'")
    industry = models.CharField(max_length=100, blank=True, help_text="Industry/Domain")
    bio = models.TextField(blank=True)
    location = models.CharField(max_length=255, blank=True, help_text="City, State/Country")
    avatar = models.ImageField(upload_to="avatars/", null=True, blank=True)

    skills = models.TextField(blank=True, help_text="Comma-separated skills, any domain")
    total_experience_months = models.PositiveIntegerField(default=0)

    resume = models.FileField(upload_to="resumes/", null=True, blank=True)
    resume_updated_at = models.DateTimeField(null=True, blank=True)

    company_name = models.CharField(max_length=255, blank=True, help_text="Recruiter's company")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Profile<{self.user.username}>"


class WorkExperience(models.Model):
    """
    Structured work-history entry, either manually entered by the applicant
    or auto-extracted by the resume parser. Stores month/year so we can
    compute accurate total experience spans across any role or industry.
    """
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="experiences")

    job_title = models.CharField(max_length=255, blank=True)
    company = models.CharField(max_length=255, blank=True)

    start_month = models.PositiveSmallIntegerField(null=True, blank=True)  # 1-12
    start_year = models.PositiveSmallIntegerField(null=True, blank=True)
    end_month = models.PositiveSmallIntegerField(null=True, blank=True)
    end_year = models.PositiveSmallIntegerField(null=True, blank=True)
    is_current = models.BooleanField(default=False)

    source = models.CharField(
        max_length=20,
        choices=(("manual", "Manual"), ("resume", "Resume Parsed")),
        default="manual",
    )

    def __str__(self):
        return f"{self.job_title or 'Role'} @ {self.company or 'Unknown'}"

    class Meta:
        ordering = ["-start_year", "-start_month"]


class Education(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="education")
    institution = models.CharField(max_length=255)
    institution_url = models.URLField(blank=True)
    degree = models.CharField(max_length=255, blank=True)
    field_of_study = models.CharField(max_length=255, blank=True)
    start_year = models.PositiveSmallIntegerField(null=True, blank=True)
    end_year = models.PositiveSmallIntegerField(null=True, blank=True)
    is_current = models.BooleanField(default=False)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["-start_year", "-id"]

    def __str__(self):
        return f"{self.degree or 'Education'} at {self.institution}"


class Achievement(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="achievements")
    title = models.CharField(max_length=255)
    issuer = models.CharField(max_length=255, blank=True)
    year = models.PositiveSmallIntegerField(null=True, blank=True)
    description = models.TextField(blank=True)
    credential_url = models.URLField(blank=True)

    class Meta:
        ordering = ["-year", "-id"]

    def __str__(self):
        return self.title
