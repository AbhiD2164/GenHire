import re

from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import CustomUser


@override_settings(
	EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
	DEFAULT_FROM_EMAIL="test@genhire.local",
	FRONTEND_URL="https://genhire.example",
	SECURE_SSL_REDIRECT=False,
)
class AuthenticationFlowTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.email = "candidate@example.com"
		self.password = "AuditPass!123"

	def test_email_otp_verifies_account_before_login(self):
		signup = self.client.post(
			"/api/auth/signup/",
			{
				"username": "candidate",
				"email": self.email,
				"password": self.password,
				"role": "applicant",
			},
			format="json",
		)
		self.assertEqual(signup.status_code, 201)
		self.assertEqual(self.client.post(
			"/api/auth/login/",
			{"username": self.email, "password": self.password},
			format="json",
		).status_code, 400)

		code = re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)
		verify = self.client.post(
			"/api/auth/email-verification/confirm/",
			{"email": self.email, "code": code},
			format="json",
		)
		self.assertEqual(verify.status_code, 200)
		self.assertEqual(self.client.post(
			"/api/auth/login/",
			{"username": self.email, "password": self.password},
			format="json",
		).status_code, 200)

	def test_reset_uses_configured_frontend_and_validates_password(self):
		user = CustomUser.objects.create_user(
			username="reset-candidate",
			email=self.email,
			password=self.password,
			email_verified=True,
		)
		request = self.client.post(
			"/api/auth/password-reset/",
			{"email": self.email, "frontend_url": "https://attacker.example/reset-password"},
			format="json",
		)
		self.assertEqual(request.status_code, 200)
		reset_url = re.search(r"https://genhire\.example/reset-password\?[^\s]+", mail.outbox[-1].body).group(0)
		uid, token = [part.split("=", 1)[1] for part in reset_url.split("?", 1)[1].split("&")]

		weak = self.client.post(
			"/api/auth/password-reset-confirm/",
			{"uid": uid, "token": token, "new_password": "123"},
			format="json",
		)
		self.assertEqual(weak.status_code, 400)
		self.assertTrue(user.check_password(self.password))

		valid = self.client.post(
			"/api/auth/password-reset-confirm/",
			{"uid": uid, "token": token, "new_password": "ResetPass!123"},
			format="json",
		)
		self.assertEqual(valid.status_code, 200)
