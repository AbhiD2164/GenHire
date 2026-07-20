from django.db.models import Q
from rest_framework import generics, permissions, status, filters
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import CustomUser, Profile, WorkExperience
from .serializers import (
    SignupSerializer, ProfileSerializer, WorkExperienceSerializer, UserSummarySerializer,
)
import os
from django.core.mail import send_mail
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken
import requests


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Allows logging in with email OR username in the same 'username' field."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["username"] = user.username
        return token

    def validate(self, attrs):
        login_value = attrs.get("username")
        try:
            user_obj = CustomUser.objects.get(email__iexact=login_value)
            attrs["username"] = user_obj.username
        except CustomUser.DoesNotExist:
            pass
        return super().validate(attrs)


class LoginView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer
    permission_classes = [permissions.AllowAny]


class SignupView(generics.CreateAPIView):
    queryset = CustomUser.objects.all()
    serializer_class = SignupSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {"message": "Account created successfully. Please log in.", "username": user.username},
            status=status.HTTP_201_CREATED,
        )


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile, _ = Profile.objects.get_or_create(user=request.user)
        return Response(ProfileSerializer(profile, context={"request": request}).data)

    def patch(self, request):
        profile, _ = Profile.objects.get_or_create(user=request.user)
        serializer = ProfileSerializer(profile, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Allow first/last name updates through the same endpoint
        first_name = request.data.get("first_name")
        last_name = request.data.get("last_name")
        if first_name is not None or last_name is not None:
            user = request.user
            if first_name is not None:
                user.first_name = first_name
            if last_name is not None:
                user.last_name = last_name
            user.save()

        return Response(ProfileSerializer(profile, context={"request": request}).data)


class PublicProfileView(generics.RetrieveAPIView):
    queryset = Profile.objects.select_related("user").prefetch_related("experiences")
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "user_id"
    lookup_url_kwarg = "user_id"


class WorkExperienceListCreateView(generics.ListCreateAPIView):
    serializer_class = WorkExperienceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return WorkExperience.objects.filter(profile__user=self.request.user)

    def perform_create(self, serializer):
        profile, _ = Profile.objects.get_or_create(user=self.request.user)
        serializer.save(profile=profile, source="manual")


class WorkExperienceDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = WorkExperienceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return WorkExperience.objects.filter(profile__user=self.request.user)


class CandidateSearchView(generics.ListAPIView):
    """
    Lets recruiters search candidates by skill, location, headline/name —
    works for any industry since it's just matching free-text fields.
    """
    serializer_class = UserSummarySerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ["username", "first_name", "last_name"]

    def get_queryset(self):
        qs = CustomUser.objects.filter(role="applicant").select_related("profile")

        skill = self.request.query_params.get("skill")
        location = self.request.query_params.get("location")
        min_exp_years = self.request.query_params.get("min_experience_years")

        if skill:
            qs = qs.filter(profile__skills__icontains=skill)
        if location:
            qs = qs.filter(profile__location__icontains=location)
        if min_exp_years:
            try:
                months = int(float(min_exp_years) * 12)
                qs = qs.filter(profile__total_experience_months__gte=months)
            except ValueError:
                pass

        return qs.distinct().order_by("id")


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email")
        if not email:
            return Response({"detail": "Email required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = CustomUser.objects.get(email__iexact=email)
        except CustomUser.DoesNotExist:
            # don't reveal whether the email exists
            return Response({"detail": "If an account with that email exists, a reset link was sent."})

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        reset_link = request.data.get("frontend_url") or "http://localhost:5173/reset-password"
        reset_url = f"{reset_link}?uid={uid}&token={token}"

        subject = "Reset your GenHire password"
        message = f"Hi,\n\nUse the following link to reset your password:\n{reset_url}\n\nIf you did not request this, ignore this email."
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=True)

        return Response({"detail": "If an account with that email exists, a reset link was sent."})


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        uid = request.data.get("uid")
        token = request.data.get("token")
        new_password = request.data.get("new_password")
        if not uid or not token or not new_password:
            return Response({"detail": "uid, token and new_password are required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            uid_decoded = force_str(urlsafe_base64_decode(uid))
            user = CustomUser.objects.get(pk=uid_decoded)
        except Exception:
            return Response({"detail": "Invalid uid."}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response({"detail": "Invalid or expired token."}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()
        return Response({"detail": "Password has been reset successfully."})


class GoogleOAuthView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        id_token = request.data.get("id_token")
        if not id_token:
            return Response({"detail": "id_token required."}, status=status.HTTP_400_BAD_REQUEST)

        # Verify token with Google
        resp = requests.get("https://oauth2.googleapis.com/tokeninfo", params={"id_token": id_token})
        if resp.status_code != 200:
            return Response({"detail": "Invalid Google token."}, status=status.HTTP_400_BAD_REQUEST)

        info = resp.json()
        email = info.get("email")
        email_verified = info.get("email_verified") in ("true", True, "True")
        name = info.get("name") or ""

        if settings.GOOGLE_CLIENT_ID:
            audience = info.get("aud") or info.get("azp")
            if audience != settings.GOOGLE_CLIENT_ID:
                return Response({"detail": "Invalid Google token audience."}, status=status.HTTP_400_BAD_REQUEST)

        if not email or not email_verified:
            return Response({"detail": "Google account email not verified."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = CustomUser.objects.get(email__iexact=email)
            created = False
        except CustomUser.DoesNotExist:
            user = CustomUser.objects.create(username=email.split("@")[0], email=email)
            created = True

        refresh = RefreshToken.for_user(user)
        return Response({"access": str(refresh.access_token), "refresh": str(refresh)})
