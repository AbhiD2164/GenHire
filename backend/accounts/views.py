import secrets
from datetime import timedelta

from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.password_validation import validate_password
from django.db.models import Q
from rest_framework import generics, permissions, status, filters, serializers
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import CustomUser, EmailVerificationCode, Profile, WorkExperience
from .serializers import (
    SignupSerializer, ProfileSerializer, WorkExperienceSerializer, UserSummarySerializer,
)
from .verification import verify_recruiter_profile
from .firebase_service import (
    send_firebase_email_verification,
    send_firebase_password_reset,
)
import os
from django.core.mail import send_mail
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.utils import timezone
from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken
import requests


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Allows logging in with email OR username in the same 'username' field, checking biased password."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
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

        # Company affiliation updates for recruiter verification
        company_name = request.data.get("company_name")
        company_website = request.data.get("company_website")
        if company_name is not None:
            user.company_name = company_name.strip()
            user_updated_fields.append("company_name")
        if company_website is not None:
            user.company_website = company_website.strip()
            user_updated_fields.append("company_website")

        if user.role == "recruiter" and (company_name is not None or company_website is not None):
            is_v, notes = verify_recruiter_profile(user.email, user.company_name, user.company_website)
            user.is_recruiter_verified = is_v
            user.recruiter_verification_notes = notes
            user_updated_fields.extend(["is_recruiter_verified", "recruiter_verification_notes"])

        if user_updated_fields:
            user.save(update_fields=list(set(user_updated_fields)))

        serializer = ProfileSerializer(profile, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()

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

    def list(self, request, *args, **kwargs):
        if request.user.role != "recruiter":
            return Response({"detail": "Only recruiters can search candidates."}, status=status.HTTP_403_FORBIDDEN)
        return super().list(request, *args, **kwargs)
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
        reset_link = (settings.FRONTEND_URL or "http://localhost:5173").rstrip("/") + "/reset-password"
        reset_url = f"{reset_link}?uid={uid}&token={token}"

        send_firebase_password_reset(user, reset_url)

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

        try:
            validate_password(new_password, user)
        except Exception as exc:
            return Response({"new_password": list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

        from .serializers import get_user_password_bias
        salt_bias = get_user_password_bias(user.username)
        user.set_password(f"{new_password}#{salt_bias}")
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

        requested_role = request.data.get("role", "applicant")
        if requested_role not in {"applicant", "recruiter"}:
            requested_role = "applicant"

        try:
            user = CustomUser.objects.get(email__iexact=email)
        except CustomUser.DoesNotExist:
            username = email.split("@")[0]
            if CustomUser.objects.filter(username=username).exists():
                username = f"{username}_{secrets.token_hex(3)}"
            user = CustomUser.objects.create(
                username=username,
                email=email,
                role=requested_role,
                email_verified=True,
            )

        refresh = RefreshToken.for_user(user)
        return Response({"access": str(refresh.access_token), "refresh": str(refresh)})


class FirebaseLoginView(APIView):
    """
    Exchanges a Firebase Auth ID Token for GenHire 7-day JWT tokens.
    Handles user creation or sync using Firebase verified email.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        id_token = request.data.get("id_token")
        requested_role = request.data.get("role", "applicant")
        company_name = request.data.get("company_name", "")
        company_website = request.data.get("company_website", "")

        if not id_token:
            return Response({"detail": "Firebase id_token is required."}, status=status.HTTP_400_BAD_REQUEST)

        email = None
        email_verified = False
        display_name = ""

        # Attempt verification via firebase_admin
        try:
            import firebase_admin.auth
            decoded = firebase_admin.auth.verify_id_token(id_token)
            email = decoded.get("email")
            email_verified = decoded.get("email_verified", False)
            display_name = decoded.get("name", "")
        except Exception:
            # Fallback to Google / Firebase tokeninfo endpoint
            try:
                resp = requests.get("https://oauth2.googleapis.com/tokeninfo", params={"id_token": id_token})
                if resp.status_code == 200:
                    info = resp.json()
                    email = info.get("email")
                    email_verified = info.get("email_verified") in ("true", True, "True")
                    display_name = info.get("name", "")
            except Exception:
                pass

        if not email:
            return Response({"detail": "Unable to verify Firebase token or extract email."}, status=status.HTTP_400_BAD_REQUEST)

        if requested_role not in {"applicant", "recruiter"}:
            requested_role = "applicant"

        try:
            user = CustomUser.objects.get(email__iexact=email)
            if email_verified and not user.email_verified:
                user.email_verified = True
                user.save(update_fields=["email_verified"])
        except CustomUser.DoesNotExist:
            username = email.split("@")[0].replace(".", "_")
            if CustomUser.objects.filter(username=username).exists():
                username = f"{username}_{secrets.token_hex(3)}"

            is_recruiter_verified = False
            recruiter_notes = ""
            if requested_role == "recruiter":
                is_recruiter_verified, recruiter_notes = verify_recruiter_profile(email, company_name, company_website)

            user = CustomUser.objects.create(
                username=username,
                email=email,
                role=requested_role,
                email_verified=email_verified,
                first_name=display_name.split()[0] if display_name else "",
                last_name=" ".join(display_name.split()[1:]) if display_name and len(display_name.split()) > 1 else "",
                company_name=company_name if requested_role == "recruiter" else "",
                company_website=company_website if requested_role == "recruiter" else "",
                is_recruiter_verified=is_recruiter_verified,
                recruiter_verification_notes=recruiter_notes,
                is_candidate_verified=True if requested_role == "applicant" else False,
            )
            Profile.objects.create(user=user, company_name=company_name if requested_role == "recruiter" else "")

        refresh = RefreshToken.for_user(user)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "is_recruiter_verified": user.is_recruiter_verified,
                "is_candidate_verified": user.is_candidate_verified,
            }
        })
