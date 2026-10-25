from django.test import TestCase
from rest_framework.test import APIClient
from unittest.mock import patch

from accounts.models import CustomUser
from network.models import Notification
from .models import Application, Job


class ApplicationInvitationTests(TestCase):
    def setUp(self):
        self.owner = CustomUser.objects.create_user(
            username="job-owner",
            email="owner@example.com",
            password="test-password",
        )
        self.applicant = CustomUser.objects.create_user(
            username="job-applicant",
            email="applicant@example.com",
            password="test-password",
        )
        self.other_user = CustomUser.objects.create_user(
            username="other-member",
            email="other@example.com",
            password="test-password",
        )
        self.job = Job.objects.create(
            title="Product Designer",
            company_name="GenHire",
            description="Design products for professional communities.",
            skills_required="Product design",
            created_by=self.owner,
        )
        self.application = Application.objects.create(
            job=self.job,
            applicant=self.applicant,
            resume="applications/sample.pdf",
        )
        self.client = APIClient()

    def test_job_owner_can_send_interview_or_assessment_notification(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(
            f"/api/jobs/applications/{self.application.id}/invite/",
            {"type": "interview", "message": "Tuesday at 10:00 UTC"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        notification = Notification.objects.get(id=response.data["id"])
        self.assertEqual(notification.recipient, self.applicant)
        self.assertEqual(notification.notification_type, "interview_invite")
        self.assertIn("Tuesday at 10:00 UTC", notification.body)

    def test_other_members_cannot_send_invitation(self):
        self.client.force_authenticate(self.other_user)
        response = self.client.post(
            f"/api/jobs/applications/{self.application.id}/invite/",
            {"type": "assessment", "message": "Complete the assessment."},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(Notification.objects.exists())

    def test_invitation_requires_type_and_details(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(
            f"/api/jobs/applications/{self.application.id}/invite/",
            {"type": "interview", "message": ""},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Notification.objects.exists())

    @patch("jobs.views.send_immediate_application_result_email")
    def test_job_owner_decision_is_marked_as_a_human_training_label(self, send_email):
        self.client.force_authenticate(self.owner)
        response = self.client.post(
            f"/api/jobs/applications/{self.application.id}/decision/",
            {"action": "select", "reason": "Relevant experience"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.application.refresh_from_db()
        self.assertTrue(self.application.human_reviewed)
        send_email.assert_called_once_with(self.application)
