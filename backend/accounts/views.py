import logging
import secrets
from binascii import Error as Base64DecodeError
from datetime import timedelta
from smtplib import SMTPException

from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.tokens import default_token_generator
from django.contrib.auth.password_validation import validate_password
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db.models import Q
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import generics, permissions, status, filters, serializers
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Achievement, CustomUser, Education, EmailVerificationCode, Profile, WorkExperience
from .serializers import (
    SignupSerializer, ProfileSerializer, WorkExperienceSerializer, EducationSerializer,
    AchievementSerializer, PublicProfileSerializer, UserSummarySerializer,
)
from .firebase_service import (
    verify_firebase_token,
    send_firebase_email_verification,
    send_firebase_password_reset,
)

logger = logging.getLogger(__name__)


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Allows logging in with email OR username in the same 'username' field, checking biased password."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        return token

    def validate(self, attrs):
        login_value = attrs.get("username", "").strip()
        raw_password = attrs.get("password", "")

        user = None
        try:
            user = CustomUser.objects.get(email__iexact=login_value)
            attrs["username"] = user.username
        except CustomUser.DoesNotExist:
            try:
                user = CustomUser.objects.get(username__iexact=login_value)
            except CustomUser.DoesNotExist:
                user = None

        if user:
            from .serializers import get_user_password_bias
            salt_bias = get_user_password_bias(user.username)
            biased_pw = f"{raw_password}#{salt_bias}"

            if user.check_password(biased_pw):
                attrs["password"] = biased_pw
            elif user.check_password(raw_password):
                attrs["password"] = raw_password

            if not user.email_verified:
                raise serializers.ValidationError({"detail": "Please verify your email with the OTP code before logging in."})

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
        _send_verification_code(user)
        return Response(
            {"message": "Account created. Check your email for the verification code.", "username": user.username, "email_verification_required": True},
            status=status.HTTP_201_CREATED,
        )


def _send_verification_code(user):
    code = f"{secrets.randbelow(1_000_000):06d}"
    EmailVerificationCode.objects.filter(user=user).delete()
    EmailVerificationCode.objects.create(
        user=user,
        code_hash=make_password(code),
        expires_at=timezone.now() + timedelta(minutes=10),
    )
    send_firebase_email_verification(user, code)


class EmailVerificationRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip()
        user = CustomUser.objects.filter(email__iexact=email).first()
        if user and not user.email_verified:
            _send_verification_code(user)
        return Response({"detail": "If an unverified account exists, a verification code was sent."})


class EmailVerificationConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip()
        code = request.data.get("code", "").strip()
        user = CustomUser.objects.filter(email__iexact=email).first()
        verification = user.verification_codes.order_by("-created_at").first() if user else None
        if not user or not verification or not verification.is_valid() or not check_password(code, verification.code_hash):
            if verification and verification.attempts < 5:
                verification.attempts += 1
                verification.save(update_fields=["attempts"])
            return Response({"detail": "Invalid or expired verification code."}, status=status.HTTP_400_BAD_REQUEST)
        user.email_verified = True
        user.save(update_fields=["email_verified"])
        verification.delete()
        return Response({"detail": "Email verified. You can now log in."})


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile, _ = Profile.objects.get_or_create(user=request.user)
        return Response(ProfileSerializer(profile, context={"request": request}).data)

    def patch(self, request):
        user = request.user
        profile, _ = Profile.objects.get_or_create(user=user)

        # Allow username updates
        new_username = request.data.get("username")
        if new_username and new_username.strip() and new_username.strip() != user.username:
            clean_username = new_username.strip()
            if CustomUser.objects.filter(username__iexact=clean_username).exclude(id=user.id).exists():
                return Response({"detail": "This username is already taken by another account."}, status=status.HTTP_400_BAD_REQUEST)
            user.username = clean_username
            user.save(update_fields=["username"])

        # Allow first/last name and phone updates through the same endpoint
        first_name = request.data.get("first_name")
        last_name = request.data.get("last_name")
        phone_number = request.data.get("phone_number")
        user_updated_fields = []
        if first_name is not None:
            user.first_name = first_name.strip()
            user_updated_fields.append("first_name")
        if last_name is not None:
            user.last_name = last_name.strip()
            user_updated_fields.append("last_name")
        if phone_number is not None:
            user.phone_number = phone_number.strip()
            user_updated_fields.append("phone_number")

        company_name = request.data.get("company_name")
        company_website = request.data.get("company_website")
        if company_name is not None:
            user.company_name = str(company_name or "").strip()
            user_updated_fields.append("company_name")
        if company_website is not None:
            user.company_website = serializers.URLField(
                allow_blank=True
            ).run_validation(company_website)
            user_updated_fields.append("company_website")

        if user_updated_fields:
            user.save(update_fields=list(set(user_updated_fields)))

        profile_data = request.data.copy()
        for user_field in ("username", "first_name", "last_name", "phone_number", "company_website"):
            profile_data.pop(user_field, None)
        serializer = ProfileSerializer(profile, data=profile_data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(ProfileSerializer(profile, context={"request": request}).data)


class PublicProfileView(generics.RetrieveAPIView):
    queryset = Profile.objects.select_related("user").prefetch_related(
        "experiences", "education", "achievements"
    )
    serializer_class = PublicProfileSerializer
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


class EducationListCreateView(generics.ListCreateAPIView):
    serializer_class = EducationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Education.objects.filter(profile__user=self.request.user)

    def perform_create(self, serializer):
        profile, _ = Profile.objects.get_or_create(user=self.request.user)
        serializer.save(profile=profile)


class EducationDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = EducationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Education.objects.filter(profile__user=self.request.user)


class AchievementListCreateView(generics.ListCreateAPIView):
    serializer_class = AchievementSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Achievement.objects.filter(profile__user=self.request.user)

    def perform_create(self, serializer):
        profile, _ = Profile.objects.get_or_create(user=self.request.user)
        serializer.save(profile=profile)


class AchievementDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AchievementSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Achievement.objects.filter(profile__user=self.request.user)


class PeopleSearchView(generics.ListAPIView):
    """
    Search talent / members by skill, location, headline/name —
    works for any industry since it's just matching free-text fields.
    """
    serializer_class = UserSummarySerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = [
        "username", "first_name", "last_name", "profile__headline",
        "profile__industry", "profile__location", "profile__skills",
        "company_name",
    ]

    def get_queryset(self):
        qs = CustomUser.objects.exclude(id=self.request.user.id).select_related("profile")

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
        email = request.data.get("email", "")
        if not isinstance(email, str) or not email.strip():
            return Response({"detail": "Email required."}, status=status.HTTP_400_BAD_REQUEST)
        email = email.strip()

        frontend_url = settings.FRONTEND_URL
        if not frontend_url and not settings.DEBUG:
            logger.error("Password reset is unavailable because FRONTEND_URL is not configured.")
            return Response(
                {"detail": "Password reset is temporarily unavailable. Please try again later."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if (
            settings.EMAIL_BACKEND == "django.core.mail.backends.smtp.EmailBackend"
            and (not settings.EMAIL_HOST or not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD)
        ):
            logger.error("Password reset is unavailable because SMTP email settings are incomplete.")
            return Response(
                {"detail": "Password reset is temporarily unavailable. Please try again later."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            user = CustomUser.objects.get(email__iexact=email)
        except CustomUser.DoesNotExist:
            # don't reveal whether the email exists
            return Response({"detail": "If an account with that email exists, a reset link was sent."})

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        reset_link = (frontend_url or "http://localhost:5173").rstrip("/") + "/reset-password"
        reset_url = f"{reset_link}?uid={uid}&token={token}"

        try:
            send_firebase_password_reset(user, reset_url)
        except (OSError, SMTPException):
            logger.exception("Failed to send a password reset email.")
            return Response(
                {"detail": "Password reset is temporarily unavailable. Please try again later."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response({"detail": "If an account with that email exists, a reset link was sent."})


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        uid = request.data.get("uid")
        token = request.data.get("token")
        new_password = request.data.get("new_password")
        if not all(isinstance(value, str) and value for value in (uid, token, new_password)):
            return Response({"detail": "uid, token and new_password are required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            uid_decoded = force_str(urlsafe_base64_decode(uid))
        except (Base64DecodeError, TypeError, UnicodeDecodeError, ValueError):
            return Response({"detail": "Invalid uid."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = CustomUser.objects.get(pk=uid_decoded)
        except (CustomUser.DoesNotExist, TypeError, ValueError):
            return Response({"detail": "Invalid uid."}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response({"detail": "Invalid or expired token."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_password(new_password, user)
        except ValidationError as exc:
            return Response({"new_password": list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

        from .serializers import get_user_password_bias
        salt_bias = get_user_password_bias(user.username)
        user.set_password(f"{new_password}#{salt_bias}")
        user.save()
        return Response({"detail": "Password has been reset successfully."})


class GoogleOAuthView(APIView):
    """
    Legacy endpoint kept for backward compatibility.
    Accepts a Google/Firebase ID token and returns GenHire JWT pair.
    Now delegates to the same verification logic as FirebaseLoginView.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        id_token = request.data.get("id_token")
        if not id_token:
            return Response({"detail": "id_token required."}, status=status.HTTP_400_BAD_REQUEST)

        token_info = verify_firebase_token(id_token)
        if not token_info:
            return Response({"detail": "Invalid or expired Google/Firebase token."}, status=status.HTTP_400_BAD_REQUEST)

        email = token_info.get("email", "")
        email_verified = token_info.get("email_verified", False)
        display_name = token_info.get("name", "")

        if not email or not email_verified:
            return Response({"detail": "Google account email is not verified."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = CustomUser.objects.get(email__iexact=email)
        except CustomUser.DoesNotExist:
            username = email.split("@")[0].replace(".", "_")
            if CustomUser.objects.filter(username=username).exists():
                username = f"{username}_{secrets.token_hex(3)}"
            user = CustomUser.objects.create(
                username=username,
                email=email,
                email_verified=True,
                first_name=display_name.split()[0] if display_name else "",
                last_name=" ".join(display_name.split()[1:]) if display_name and len(display_name.split()) > 1 else "",
            )
            Profile.objects.get_or_create(user=user)

        refresh = RefreshToken.for_user(user)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
            },
        })


class FirebaseLoginView(APIView):
    """
    Primary Google / Firebase sign-in endpoint.

    Accepts a Firebase Auth ID Token (obtained from Firebase client SDK after
    Google sign-in or email/password sign-in) and returns GenHire JWT access +
    refresh tokens.

    Flow:
      1. Verify the Firebase ID token using firebase_admin SDK (preferred) or
         Google's tokeninfo fallback.
      2. Extract email + email_verified + display name.
      3. Find or create the GenHire CustomUser for that email.
      4. Issue 7-day access token + 30-day refresh token.

    Error codes:
      400 — missing id_token, unverified email, or unverifiable token
      500 — unexpected server error (logged)
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        id_token = request.data.get("id_token")
        if not id_token:
            return Response(
                {"detail": "Firebase id_token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Verify the token ──────────────────────────────────────────────────
        token_info = verify_firebase_token(id_token)

        if not token_info:
            return Response(
                {
                    "detail": (
                        "Unable to verify Firebase token. "
                        "Please ensure you are using a valid Firebase project and try again."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = token_info.get("email", "").strip()
        email_verified = token_info.get("email_verified", False)
        display_name = token_info.get("name", "").strip()

        if not email:
            return Response(
                {"detail": "No email address found in the Google account token."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not email_verified:
            return Response(
                {"detail": "Your Google account email is not verified. Please verify it with Google first."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        company_name = (request.data.get("company_name") or "").strip()
        company_website = (request.data.get("company_website") or "").strip()

        # ── Find or create the GenHire user ───────────────────────────────────
        try:
            user = CustomUser.objects.get(email__iexact=email)
            # Sync email_verified flag in case it changed
            if email_verified and not user.email_verified:
                user.email_verified = True
                user.save(update_fields=["email_verified"])

        except CustomUser.DoesNotExist:
            # Derive a unique username from the email prefix
            base_username = email.split("@")[0].replace(".", "_")
            username = base_username
            if CustomUser.objects.filter(username__iexact=username).exists():
                username = f"{base_username}_{secrets.token_hex(3)}"

            name_parts = display_name.split()
            user = CustomUser.objects.create(
                username=username,
                email=email,
                email_verified=True,  # Google guarantees this
                first_name=name_parts[0] if name_parts else "",
                last_name=" ".join(name_parts[1:]) if len(name_parts) > 1 else "",
                company_name=company_name,
                company_website=company_website,
            )
            Profile.objects.get_or_create(
                user=user,
                defaults={"company_name": company_name},
            )

        # ── Issue GenHire JWT pair ────────────────────────────────────────────
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                },
            }
        )
