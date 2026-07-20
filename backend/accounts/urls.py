from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    GoogleOAuthView, LoginView, PasswordResetConfirmView, PasswordResetRequestView, SignupView, MeView, PublicProfileView,
    WorkExperienceListCreateView, WorkExperienceDetailView, CandidateSearchView,
)

urlpatterns = [
    path("signup/", SignupView.as_view(), name="signup"),
    path("login/", LoginView.as_view(), name="login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("profile/<int:user_id>/", PublicProfileView.as_view(), name="public_profile"),
    path("experience/", WorkExperienceListCreateView.as_view(), name="experience_list"),
    path("experience/<int:pk>/", WorkExperienceDetailView.as_view(), name="experience_detail"),
    path("candidates/search/", CandidateSearchView.as_view(), name="candidate_search"),
    path("password-reset/", PasswordResetRequestView.as_view(), name="password_reset"),
    path("password-reset-confirm/", PasswordResetConfirmView.as_view(), name="password_reset_confirm"),
    path("google/", GoogleOAuthView.as_view(), name="google_oauth"),
]
