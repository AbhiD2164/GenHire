"""
Firebase Authentication & Email Messaging Service.
Handles email messaging (verification, password reset, application result notifications)
integrating Firebase Auth / Firebase Admin SDK and fallback email backend.
"""
import logging
from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)

# Optional Firebase Admin SDK initialization
_firebase_initialized = False

def get_firebase_app():
    global _firebase_initialized
    if _firebase_initialized:
        return True
    try:
        import firebase_admin
        from firebase_admin import credentials
        cred_path = getattr(settings, "FIREBASE_CREDENTIALS_PATH", "")
        if cred_path:
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            _firebase_initialized = True
            return True
        elif not firebase_admin._apps:
            # Initialize default app if project id is configured
            project_id = getattr(settings, "FIREBASE_PROJECT_ID", "")
            if project_id:
                firebase_admin.initialize_app(options={"projectId": project_id})
                _firebase_initialized = True
                return True
    except Exception as e:
        logger.warning(f"Firebase initialization skipped or failed: {e}")
    return False


def send_firebase_email_verification(user, code: str):
    """
    Sends email verification to user using Firebase / Django email backend.
    """
    subject = "Verify your GenHire Account (Firebase Auth)"
    message = (
        f"Hello {user.get_full_name() or user.username},\n\n"
        f"Thank you for registering with GenHire. Your verification code is:\n\n"
        f"    {code}\n\n"
        f"This code will expire in 10 minutes.\n\n"
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
    """
    Sends password reset instructions.
    """
    subject = "Reset your GenHire Password"
    message = (
        f"Hello {user.get_full_name() or user.username},\n\n"
        f"You requested a password reset. Click the link below to set a new password:\n"
        f"{reset_url}\n\n"
        f"If you did not make this request, you can safely ignore this email.\n\n"
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


def send_immediate_application_result_email(application):
    """
    Immediately communicates candidate application outcome and ATS resume score via email.
    Addresses communication delays.
    """
    applicant = application.applicant
    job = application.job
    score_pct = round(application.score * 100, 1)

    status_str = application.status.capitalize()
    rejection_stage = getattr(application, "rejection_stage", "")
    rejection_reason = getattr(application, "rejection_reason", "")

    if application.status == "selected":
        subject = f"GenHire: Congratulations! Your Application for {job.title} at {job.company_name} was Selected"
        body = (
            f"Dear {applicant.get_full_name() or applicant.username},\n\n"
            f"Great news! Your application for the position of '{job.title}' at {job.company_name} "
            f"has been evaluated and SELECTED.\n\n"
            f"Resume ATS Score: {score_pct}/100 (Perfect / Strong match)\n"
            f"Status: Selected\n"
            f"Location: {job.location}\n\n"
            f"Next Steps: The hiring team has your profile and will be in touch regarding the interview stage.\n"
            f"You can also track this in your GenHire dashboard under 'Selected Jobs'.\n\n"
            f"Best regards,\n"
            f"GenHire Automated ATS & Recruitment Engine"
        )
    elif application.status == "rejected":
        subject = f"GenHire: Application Update for {job.title} at {job.company_name}"
        stage_desc = "Application rejected by system" if rejection_stage == "rejected_by_system" else "Application rejected by recruiter"
        body = (
            f"Dear {applicant.get_full_name() or applicant.username},\n\n"
            f"Thank you for your interest in the '{job.title}' position at {job.company_name}.\n\n"
            f"Your application evaluation results:\n"
            f"• Resume ATS Score: {score_pct}/100\n"
            f"• Stage: {stage_desc}\n"
            f"• Reason: {rejection_reason or application.feedback or 'Does not meet match criteria'}\n\n"
            f"Don't be discouraged! Check your GenHire runtime suggestions dashboard for matching job openings "
            f"tailored specifically to your resume's strengths and skills.\n\n"
            f"Best regards,\n"
            f"GenHire Automated ATS & Recruitment Engine"
        )
    else:
        subject = f"GenHire: Application Received for {job.title} at {job.company_name}"
        body = (
            f"Dear {applicant.get_full_name() or applicant.username},\n\n"
            f"Your application for '{job.title}' has been successfully received.\n"
            f"Resume ATS Score: {score_pct}/100 (In Review / Partial Match)\n"
            f"Status: In Review\n\n"
            f"You will be immediately notified of any recruiter updates.\n\n"
            f"Best regards,\n"
            f"GenHire Team"
        )

    send_mail(
        subject,
        body,
        settings.DEFAULT_FROM_EMAIL,
        [applicant.email],
        fail_silently=True,
    )
