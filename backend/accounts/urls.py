from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    GoogleOAuthView, FirebaseLoginView, LoginView, PasswordResetConfirmView, PasswordResetRequestView, SignupView, MeView, PublicProfileView,
    EmailVerificationRequestView, EmailVerificationConfirmView,
    WorkExperienceListCreateView, WorkExperienceDetailView,
    EducationListCreateView, EducationDetailView,
    AchievementListCreateView, AchievementDetailView, PeopleSearchView,
)

urlpatterns = [
    path("signup/", SignupView.as_view(), name="signup"),
    path("login/", LoginView.as_view(), name="login"),
    path("firebase-login/", FirebaseLoginView.as_view(), name="firebase_login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("profile/<int:user_id>/", PublicProfileView.as_view(), name="public_profile"),
    path("experience/", WorkExperienceListCreateView.as_view(), name="experience_list"),
    path("experience/<int:pk>/", WorkExperienceDetailView.as_view(), name="experience_detail"),
    path("education/", EducationListCreateView.as_view(), name="education_list"),
    path("education/<int:pk>/", EducationDetailView.as_view(), name="education_detail"),
    path("achievements/", AchievementListCreateView.as_view(), name="achievement_list"),
    path("achievements/<int:pk>/", AchievementDetailView.as_view(), name="achievement_detail"),
    path("people/search/", PeopleSearchView.as_view(), name="people_search"),
    path("candidates/search/", PeopleSearchView.as_view(), name="candidate_search_compat"),
    path("password-reset/", PasswordResetRequestView.as_view(), name="password_reset"),
    path("password-reset-confirm/", PasswordResetConfirmView.as_view(), name="password_reset_confirm"),
    path("google/", GoogleOAuthView.as_view(), name="google_oauth"),
    path("email-verification/request/", EmailVerificationRequestView.as_view(), name="email_verification_request"),
    path("email-verification/confirm/", EmailVerificationConfirmView.as_view(), name="email_verification_confirm"),
]
