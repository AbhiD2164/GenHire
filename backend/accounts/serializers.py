import hashlib
from rest_framework import serializers
from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from .models import Achievement, CustomUser, Education, Profile, WorkExperience


def get_user_password_bias(username: str) -> str:
    """Computes deterministic cryptographic salt bias tied to user identifier and secret key."""
    raw = f"{settings.SECRET_KEY}:{username.strip().lower()}:genhire_salt"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:10]


class WorkExperienceSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkExperience
        fields = [
            "id", "job_title", "company", "start_month", "start_year",
            "end_month", "end_year", "is_current", "source",
        ]
        read_only_fields = ["source"]


class EducationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Education
        fields = [
            "id", "institution", "institution_url", "degree", "field_of_study", "start_year",
            "end_year", "is_current", "description",
        ]


class AchievementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Achievement
        fields = ["id", "title", "issuer", "year", "description", "credential_url"]


class ProfileSerializer(serializers.ModelSerializer):
    experiences = WorkExperienceSerializer(many=True, read_only=True)
    education = EducationSerializer(many=True, read_only=True)
    achievements = AchievementSerializer(many=True, read_only=True)
    full_name = serializers.SerializerMethodField()
    username = serializers.CharField(source="user.username", required=False)
    email = serializers.EmailField(source="user.email", read_only=True)
    phone_number = serializers.CharField(source="user.phone_number", required=False, allow_blank=True)
    company_website = serializers.URLField(source="user.company_website", required=False, allow_blank=True)
    user_id = serializers.IntegerField(source="user.id", read_only=True)

    class Meta:
        model = Profile
        fields = [
            "user_id", "username", "email", "phone_number", "full_name",
            "company_website",
            "headline", "industry", "bio", "location", "avatar",
            "skills", "total_experience_months",
            "resume", "resume_updated_at", "company_name",
            "experiences", "education", "achievements",
        ]

    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class PublicProfileSerializer(ProfileSerializer):
    class Meta(ProfileSerializer.Meta):
        fields = [
            "user_id", "username", "full_name", "company_website",
            "headline", "industry", "bio", "location", "avatar", "skills",
            "total_experience_months", "company_name", "experiences",
            "education", "achievements",
        ]


class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    first_name = serializers.CharField(required=True)
    last_name = serializers.CharField(required=True)
    phone_number = serializers.CharField(required=False, allow_blank=True)
    headline = serializers.CharField(required=False, allow_blank=True)
    industry = serializers.CharField(required=False, allow_blank=True)
    location = serializers.CharField(required=False, allow_blank=True)
    bio = serializers.CharField(required=False, allow_blank=True)
    company_name = serializers.CharField(required=False, allow_blank=True)
    company_website = serializers.URLField(required=False, allow_blank=True)

    class Meta:
        model = CustomUser
        fields = [
            "username", "email", "phone_number", "password",
            "first_name", "last_name", "headline", "industry", "location", "bio",
            "company_name", "company_website",
        ]

    def validate_username(self, value):
        val = value.strip()
        if not val:
            raise serializers.ValidationError("Username cannot be empty.")
        if CustomUser.objects.filter(username__iexact=val).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return val

    def validate_email(self, value):
        val = value.strip().lower()
        if CustomUser.objects.filter(email__iexact=val).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return val

    def create(self, validated_data):
        password = validated_data.pop("password")
        company_name = validated_data.pop("company_name", "").strip()
        company_website = validated_data.pop("company_website", "").strip()

        # Profile fields
        headline = validated_data.pop("headline", "").strip()
        industry = validated_data.pop("industry", "").strip()
        location = validated_data.pop("location", "").strip()
        bio = validated_data.pop("bio", "").strip()

        user = CustomUser(**validated_data)
        # Apply cryptographic deterministic salt bias to password
        salt_bias = get_user_password_bias(user.username)
        user.set_password(f"{password}#{salt_bias}")
        user.email_verified = False
        user.save()

        Profile.objects.create(
            user=user,
            headline=headline or "GenHire Professional",
            industry=industry or "General",
            location=location,
            bio=bio,
            company_name=company_name,
        )
        return user


class UserSummarySerializer(serializers.ModelSerializer):
    headline = serializers.CharField(source="profile.headline", read_only=True, default="")
    industry = serializers.CharField(source="profile.industry", read_only=True, default="")
    location = serializers.CharField(source="profile.location", read_only=True, default="")
    avatar = serializers.ImageField(source="profile.avatar", read_only=True, default=None)
    company_name = serializers.CharField(read_only=True, default="")

    class Meta:
        model = CustomUser
        fields = [
            "id", "username", "first_name", "last_name",
            "headline", "industry", "location", "avatar", "company_name"
        ]
