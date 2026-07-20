from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import CustomUser, Profile, WorkExperience


class WorkExperienceSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkExperience
        fields = [
            "id", "job_title", "company", "start_month", "start_year",
            "end_month", "end_year", "is_current", "source",
        ]
        read_only_fields = ["source"]


class ProfileSerializer(serializers.ModelSerializer):
    experiences = WorkExperienceSerializer(many=True, read_only=True)
    full_name = serializers.SerializerMethodField()
    username = serializers.CharField(source="user.username", read_only=True)
    role = serializers.CharField(source="user.role", read_only=True)
    user_id = serializers.IntegerField(source="user.id", read_only=True)

    class Meta:
        model = Profile
        fields = [
            "user_id", "username", "role", "full_name",
            "headline", "bio", "location", "avatar",
            "skills", "total_experience_months",
            "resume", "resume_updated_at", "company_name",
            "experiences",
        ]

    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = CustomUser
        fields = ["username", "email", "password", "role", "first_name", "last_name"]

    def validate_email(self, value):
        if CustomUser.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = CustomUser(**validated_data)
        user.set_password(password)
        user.save()
        Profile.objects.create(user=user)
        return user


class UserSummarySerializer(serializers.ModelSerializer):
    headline = serializers.CharField(source="profile.headline", read_only=True, default="")
    location = serializers.CharField(source="profile.location", read_only=True, default="")
    avatar = serializers.ImageField(source="profile.avatar", read_only=True, default=None)

    class Meta:
        model = CustomUser
        fields = ["id", "username", "first_name", "last_name", "role", "headline", "location", "avatar"]
