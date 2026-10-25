import re

from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import CustomUser, Profile
from .serializers import get_user_password_bias


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
				"first_name": "Candidate",
				"last_name": "Member",
			},
			format="json",
		)
		self.assertEqual(signup.status_code, 201)
		self.assertTrue(Profile.objects.filter(user__email=self.email).exists())
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
		login = self.client.post(
			"/api/auth/login/",
			{"username": self.email, "password": self.password},
			format="json",
		)
		self.assertEqual(login.status_code, 200)
		self.client.credentials(
			HTTP_AUTHORIZATION=f"Bearer {login.data['access']}"
		)
		profile_response = self.client.get("/api/auth/me/")
		self.assertEqual(profile_response.status_code, 200)
		self.assertEqual(profile_response.data["username"], "candidate")

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

	def test_profile_patch_saves_user_and_profile_fields(self):
		user = CustomUser.objects.create_user(
			username="profile-candidate",
			email=self.email,
			password=self.password,
			first_name="Candidate",
			last_name="One",
			email_verified=True,
		)
		profile = Profile.objects.create(user=user)
		self.client.force_authenticate(user=user)

		response = self.client.patch(
			"/api/auth/me/",
			{
				"first_name": "Updated",
				"last_name": "Professional",
				"headline": "Clinical Data Analyst",
				"industry": "Healthcare",
				"company_name": "Northstar Health",
				"company_website": "https://northstar.example",
			},
			format="json",
		)

		self.assertEqual(response.status_code, 200)
		profile.refresh_from_db()
		user.refresh_from_db()
		self.assertEqual(profile.headline, "Clinical Data Analyst")
		self.assertEqual(profile.industry, "Healthcare")
		self.assertEqual(profile.company_name, "Northstar Health")
		self.assertEqual(user.get_full_name(), "Updated Professional")
		self.assertEqual(user.company_website, "https://northstar.example")

	def test_education_and_achievements_appear_on_public_profile(self):
		user = CustomUser.objects.create_user(
			username="profile-owner",
			email=self.email,
			password=self.password,
			first_name="Profile",
			last_name="Owner",
		)
		Profile.objects.create(user=user, industry="Design")
		self.client.force_authenticate(user=user)

		education = self.client.post(
			"/api/auth/education/",
			{
				"institution": "State University",
				"degree": "Bachelor of Design",
				"field_of_study": "Interaction Design",
				"start_year": 2020,
				"end_year": 2024,
				"is_current": False,
			},
			format="json",
		)
		achievement = self.client.post(
			"/api/auth/achievements/",
			{
				"title": "Accessibility certification",
				"issuer": "Design Institute",
				"year": 2025,
				"credential_url": "https://credentials.example/certificate",
			},
			format="json",
		)
		self.assertEqual(education.status_code, 201)
		self.assertEqual(achievement.status_code, 201)

		public_profile = self.client.get(f"/api/auth/profile/{user.id}/")
		self.assertEqual(public_profile.status_code, 200)
		self.assertEqual(public_profile.data["education"][0]["institution"], "State University")
		self.assertEqual(public_profile.data["achievements"][0]["title"], "Accessibility certification")
		self.assertNotIn("email", public_profile.data)
		self.assertNotIn("phone_number", public_profile.data)

	def test_google_created_account_can_reset_password(self):
		user = CustomUser.objects.create(
			username="google-candidate",
			email=self.email,
			email_verified=True,
		)
		request = self.client.post(
			"/api/auth/password-reset/",
			{"email": self.email},
			format="json",
		)
		self.assertEqual(request.status_code, 200)
		reset_url = re.search(r"https://genhire\.example/reset-password\?[^\s]+", mail.outbox[-1].body).group(0)
		uid, token = [part.split("=", 1)[1] for part in reset_url.split("?", 1)[1].split("&")]

		response = self.client.post(
			"/api/auth/password-reset-confirm/",
			{"uid": uid, "token": token, "new_password": "ResetPass!123"},
			format="json",
		)
		self.assertEqual(response.status_code, 200)
		user.refresh_from_db()
		biased_password = f"ResetPass!123#{get_user_password_bias(user.username)}"
		self.assertTrue(user.check_password(biased_password))

	def test_reset_rejects_malformed_uid(self):
		response = self.client.post(
			"/api/auth/password-reset-confirm/",
			{"uid": "!!!", "token": "token", "new_password": "ResetPass!123"},
			format="json",
		)
		self.assertEqual(response.status_code, 400)
		self.assertEqual(response.data["detail"], "Invalid uid.")

	def test_reset_reports_missing_smtp_configuration_consistently(self):
		CustomUser.objects.create_user(
			username="reset-candidate",
			email=self.email,
			password=self.password,
			email_verified=True,
		)
		with override_settings(
			DEBUG=False,
			EMAIL_BACKEND="django.core.mail.backends.smtp.EmailBackend",
			EMAIL_HOST="",
			EMAIL_HOST_USER="",
			EMAIL_HOST_PASSWORD="",
		):
			known_account = self.client.post(
				"/api/auth/password-reset/",
				{"email": self.email},
				format="json",
			)
			unknown_account = self.client.post(
				"/api/auth/password-reset/",
				{"email": "unknown@example.com"},
				format="json",
			)

		self.assertEqual(known_account.status_code, 503)
		self.assertEqual(unknown_account.status_code, 503)
