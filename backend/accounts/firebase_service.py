"""
Firebase Authentication & Email Messaging Service.

Handles:
  - Firebase Admin SDK initialisation (with service-account JSON or project-only fallback)
  - Firebase ID-token verification (used by FirebaseLoginView)
  - Email messaging: verification codes, password resets, application results

Design principles:
  * Initialisation is attempted ONCE at import time and cached.
  * Every public function is safe to call even when Firebase is not configured —
    it either falls back to Django email or logs a warning and continues.
  * The firebase_admin SDK is optional; the project can still run without it.
"""

import logging
import os
from pathlib import Path

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)

# ─── Firebase Admin SDK initialisation ────────────────────────────────────────
_firebase_app = None
_firebase_init_attempted = False


def _init_firebase():
    """Attempt to initialise the Firebase Admin SDK exactly once."""
    global _firebase_app, _firebase_init_attempted
    if _firebase_init_attempted:
        return _firebase_app is not None
    _firebase_init_attempted = True

    try:
        import firebase_admin
        from firebase_admin import credentials

        # If already initialised (e.g. by another import path), reuse the app.
        if firebase_admin._apps:
            _firebase_app = firebase_admin.get_app()
            return True

        cred_path = getattr(settings, "FIREBASE_CREDENTIALS_PATH", "")
        project_id = getattr(settings, "FIREBASE_PROJECT_ID", "")

        if cred_path:
            # Resolve relative paths against BASE_DIR (backend root)
            p = Path(cred_path)
            if not p.is_absolute():
                p = Path(settings.BASE_DIR) / cred_path
            if p.exists():
                cred = credentials.Certificate(str(p))
                _firebase_app = firebase_admin.initialize_app(cred)
                logger.info("Firebase Admin SDK initialised with service-account credentials.")
                return True
            else:
                logger.warning(
                    "FIREBASE_CREDENTIALS_PATH set but file not found at '%s'. "
                    "Falling back to project-id initialisation.",
                    p,
                )

        if project_id:
            _firebase_app = firebase_admin.initialize_app(options={"projectId": project_id})
            logger.info("Firebase Admin SDK initialised with project_id only (no service-account).")
            return True

        logger.warning(
            "Firebase Admin SDK not configured (no FIREBASE_CREDENTIALS_PATH or FIREBASE_PROJECT_ID). "
            "Google sign-in will use the tokeninfo fallback."
        )

    except Exception as exc:
        logger.warning("Firebase Admin SDK initialisation failed: %s", exc)

    return False


# Run initialisation at module import so it happens before any request.
_init_firebase()


# ─── Token verification ────────────────────────────────────────────────────────

def verify_firebase_token(id_token: str) -> dict | None:
    """
    Verify a Firebase ID token and return the decoded payload dict, or None on failure.

    Tries firebase_admin.auth first; falls back to Google's public tokeninfo API
    for cases where the Admin SDK is not available (e.g. development without
    a service-account key and no GOOGLE_APPLICATION_CREDENTIALS env var).

    Returned dict always contains at minimum:
        { "email": str, "email_verified": bool, "name": str, "uid": str }
    """
    # ── Strategy 1: firebase_admin SDK (recommended, most secure) ────────────
    if _firebase_app is not None or _init_firebase():
        try:
            import firebase_admin.auth as fa_auth
            decoded = fa_auth.verify_id_token(id_token, app=_firebase_app, check_revoked=False)
            return {
                "email": decoded.get("email", ""),
                "email_verified": decoded.get("email_verified", False),
                "name": decoded.get("name", ""),
                "uid": decoded.get("uid", decoded.get("user_id", "")),
                "picture": decoded.get("picture", ""),
            }
        except Exception as exc:
            logger.warning("firebase_admin.auth.verify_id_token failed: %s — trying tokeninfo fallback.", exc)

    # ── Strategy 2: Google tokeninfo endpoint (works for Google sign-in tokens) ─
    try:
        import requests as http
        resp = http.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": id_token},
            timeout=10,
        )
        if resp.status_code == 200:
            info = resp.json()
            ev = info.get("email_verified")
            return {
                "email": info.get("email", ""),
                "email_verified": ev in (True, "true", "True"),
                "name": info.get("name", ""),
                "uid": info.get("sub", ""),
                "picture": info.get("picture", ""),
                "aud": info.get("aud", ""),
                "azp": info.get("azp", ""),
            }
        logger.warning("tokeninfo endpoint returned %s: %s", resp.status_code, resp.text[:200])
    except Exception as exc:
        logger.warning("tokeninfo fallback also failed: %s", exc)

    return None


# ─── Email helpers ─────────────────────────────────────────────────────────────

def send_firebase_email_verification(user, code: str):
    """Send an OTP verification code to the user's email."""
    subject = "Verify your GenHire Account"
    message = (
        f"Hello {user.get_full_name() or user.username},\n\n"
        f"Thank you for registering with GenHire. Your verification code is:\n\n"
        f"    {code}\n\n"
        f"This code will expire in 10 minutes. Do not share it with anyone.\n\n"
        f"Best regards,\n"
        f"GenHire Team"
    )
    send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=True,
    )


def send_firebase_password_reset(user, reset_url: str):
    """Send a password reset link to the user's email."""
    subject = "Reset your GenHire Password"
    message = (
        f"Hello {user.get_full_name() or user.username},\n\n"
        f"You requested a password reset. Click the link below to set a new password:\n"
        f"{reset_url}\n\n"
        f"This link expires in 24 hours. If you did not request this, ignore this email.\n\n"
        f"Best regards,\n"
        f"GenHire Team"
    )
    send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=False,
    )


def send_immediate_application_result_email(application):
    """
    Immediately communicate candidate application outcome + ATS score via email.
    Called right after ATS processing so there is zero communication delay.
    """
    applicant = application.applicant
    job = application.job
    score_pct = round(application.score * 100, 1)

    rejection_stage = getattr(application, "rejection_stage", "")
    rejection_reason = getattr(application, "rejection_reason", "")

    if application.status == "selected":
        subject = f"GenHire: Congratulations! Your Application for {job.title} at {job.company_name} was Selected"
        body = (
            f"Dear {applicant.get_full_name() or applicant.username},\n\n"
            f"Great news! Your application for '{job.title}' at {job.company_name} has been SELECTED.\n\n"
            f"Resume ATS Score : {score_pct}/100 (Perfect / Strong match)\n"
            f"Status           : Selected\n"
            f"Location         : {job.location}\n\n"
            f"Next Steps: The hiring team will contact you for the interview stage.\n"
            f"You can track this in your GenHire Dashboard → Applied Jobs → Selected.\n\n"
            f"Best regards,\nGenHire Automated ATS & Recruitment Engine"
        )
    elif application.status == "rejected":
        subject = f"GenHire: Application Update for {job.title} at {job.company_name}"
        stage_desc = (
            "Application rejected by system (ATS score below threshold)"
            if rejection_stage == "rejected_by_system"
            else "Application reviewed and not selected by the hiring team"
        )
        body = (
            f"Dear {applicant.get_full_name() or applicant.username},\n\n"
            f"Thank you for your interest in '{job.title}' at {job.company_name}.\n\n"
            f"Application Evaluation:\n"
            f"  • Resume ATS Score : {score_pct}/100\n"
            f"  • Stage            : {stage_desc}\n"
            f"  • Reason           : {rejection_reason or application.feedback or 'Did not meet the matching criteria.'}\n\n"
            f"Don't be discouraged! Check your GenHire Dashboard → Runtime Recommendations "
            f"for job openings that better match your resume's strengths.\n\n"
            f"Best regards,\nGenHire Automated ATS & Recruitment Engine"
        )
    else:
        subject = f"GenHire: Application Received for {job.title} at {job.company_name}"
        body = (
            f"Dear {applicant.get_full_name() or applicant.username},\n\n"
            f"Your application for '{job.title}' has been received and is under review.\n"
            f"  • Resume ATS Score : {score_pct}/100 (Partial Match — In Review)\n"
            f"  • Status           : In Review\n\n"
            f"You will be immediately notified of any recruiter updates.\n\n"
            f"Best regards,\nGenHire Team"
        )

    send_mail(
        subject,
        body,
        settings.DEFAULT_FROM_EMAIL,
        [applicant.email],
        fail_silently=True,
    )
