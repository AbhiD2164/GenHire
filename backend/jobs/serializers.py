from rest_framework import serializers
from .models import Job, Application


class JobSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    required_experience_label = serializers.ReadOnlyField()
    applicant_count = serializers.SerializerMethodField()
    has_applied = serializers.SerializerMethodField()

    class Meta:
        model = Job
        fields = [
            "id", "title", "company_name", "industry", "job_type", "work_mode",
            "location", "description", "min_experience_months", "max_experience_months",
            "required_experience_label", "skills_required", "good_to_have", "education_requirements",
            "salary_min", "salary_max", "is_active",
            "created_by", "created_by_name", "created_at", "updated_at",
            "applicant_count", "has_applied",
        ]
        read_only_fields = ["created_by", "created_at", "updated_at"]

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() or obj.created_by.username

    def get_applicant_count(self, obj):
        return obj.applications.count()

    def get_has_applied(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.applications.filter(applicant=request.user).exists()


class JobWriteSerializer(serializers.ModelSerializer):
    min_experience_years = serializers.FloatField(write_only=True, required=False, default=0)
    max_experience_years = serializers.FloatField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Job
        fields = [
            "id", "title", "company_name", "industry", "job_type", "work_mode",
            "location", "description", "skills_required", "good_to_have", "education_requirements",
            "salary_min", "salary_max", "is_active",
            "min_experience_years", "max_experience_years",
        ]

    def create(self, validated_data):
        min_years = validated_data.pop("min_experience_years", 0) or 0
        max_years = validated_data.pop("max_experience_years", None)
        validated_data["min_experience_months"] = round(min_years * 12)
        validated_data["max_experience_months"] = round(max_years * 12) if max_years else None
        validated_data["created_by"] = self.context["request"].user
        return Job.objects.create(**validated_data)

    def update(self, instance, validated_data):
        min_years = validated_data.pop("min_experience_years", None)
        max_years = validated_data.pop("max_experience_years", None)
        if min_years is not None:
            instance.min_experience_months = round(min_years * 12)
        if max_years is not None:
            instance.max_experience_months = round(max_years * 12)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class ApplicationSerializer(serializers.ModelSerializer):
    job_title = serializers.CharField(source="job.title", read_only=True)
    company_name = serializers.CharField(source="job.company_name", read_only=True)
    applicant_name = serializers.SerializerMethodField()
    applicant_email = serializers.CharField(source="applicant.email", read_only=True)
    applicant_username = serializers.CharField(source="applicant.username", read_only=True)
    parsed_experience_label = serializers.SerializerMethodField()
    score_percentage = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = [
            "id", "job", "job_title", "company_name",
            "applicant", "applicant_name", "applicant_username", "applicant_email",
            "resume", "parsed_location", "parsed_experience_months",
            "parsed_experience_label", "parsed_skills",
            "score", "score_percentage", "status",
            "rejection_stage", "rejection_reason",
            "feedback", "candidate_message", "created_at", "updated_at",
        ]
        read_only_fields = [
            "applicant", "parsed_location", "parsed_experience_months",
            "parsed_skills", "score", "score_percentage", "created_at", "updated_at",
        ]

    def get_applicant_name(self, obj):
        return obj.applicant.get_full_name() or obj.applicant.username

    def get_score_percentage(self, obj):
        return round((obj.score or 0) * 100, 1)

    def get_parsed_experience_label(self, obj):
        from ats.experience_extraction import months_to_label
        return months_to_label(obj.parsed_experience_months)


class ApplicationCandidateView(serializers.ModelSerializer):
    """
    Candidate's application view showing application status, resume score,
    and clear stage/reason for rejection or selection.
    """
    job_title = serializers.CharField(source="job.title", read_only=True)
    company_name = serializers.CharField(source="job.company_name", read_only=True)
    location = serializers.CharField(source="job.location", read_only=True)
    work_mode = serializers.CharField(source="job.work_mode", read_only=True)
    score_percentage = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = [
            "id", "job", "job_title", "company_name", "location", "work_mode",
            "score", "score_percentage", "status",
            "rejection_stage", "rejection_reason",
            "candidate_message", "feedback", "created_at", "updated_at",
        ]

    def get_score_percentage(self, obj):
        return round((obj.score or 0) * 100, 1)
