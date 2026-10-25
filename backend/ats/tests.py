from django.test import TestCase

from accounts.models import CustomUser, Education, Profile
from jobs.models import Application, Job
from ml.train_recommender import _validate_dataset, build_dataset

from .matching_features import build_job_features, build_profile_features, extract_education_text
from .recommender import Recommender


class ResumeEducationExtractionTests(TestCase):
    def test_extracts_education_section_until_next_heading(self):
        resume = (
            "EDUCATION\nBSc Computer Science, Example University\n"
            "Graduated 2022\nEXPERIENCE\nPython developer"
        )

        self.assertEqual(
            extract_education_text(resume),
            "BSc Computer Science, Example University Graduated 2022",
        )

    def test_does_not_guess_education_without_a_section_heading(self):
        self.assertEqual(extract_education_text("BSc Computer Science"), "")


class MatchingFeatureTests(TestCase):
    def setUp(self):
        self.user = CustomUser.objects.create_user(
            username="profile-member",
            email="profile@example.com",
            password="valid-test-password-123",
        )
        self.profile = Profile.objects.create(
            user=self.user,
            headline="Software Engineer",
            skills="Python, Django",
            total_experience_months=36,
        )
        Education.objects.create(
            profile=self.profile,
            institution="Example University",
            degree="Bachelor of Science",
            field_of_study="Computer Science",
        )

    def test_features_compare_skills_experience_and_education(self):
        job = Job.objects.create(
            title="Python Developer",
            description="Build web applications using Django.",
            skills_required="Python, Django",
            education_requirements="Bachelor of Science in Computer Science",
            min_experience_months=24,
            created_by=self.user,
        )

        features = build_job_features(job, build_profile_features(self.user))

        self.assertEqual(features["required_skill_coverage"], 1)
        self.assertEqual(features["experience_coverage"], 1)
        self.assertGreater(features["education_coverage"], 0)
        self.assertCountEqual(features["matched_skills"], ["python", "django"])

    def test_recommendation_fallback_ranks_matching_role_without_artifact(self):
        matching_job = Job.objects.create(
            title="Python Developer",
            description="Build Django applications.",
            skills_required="Python, Django",
            education_requirements="Bachelor of Science in Computer Science",
            min_experience_months=24,
            created_by=self.user,
        )
        Job.objects.create(
            title="Nurse",
            description="Provide patient care.",
            skills_required="Nursing, Patient care",
            created_by=self.user,
        )
        recommender = Recommender()
        recommender.artifact = None

        suggestions = recommender.recommend_for_user(self.user)

        self.assertEqual(suggestions[0]["id"], matching_job.id)
        self.assertEqual(suggestions[0]["recommendation_method"], "content_similarity")


class HumanDecisionTrainingDataTests(TestCase):
    def setUp(self):
        self.owner = CustomUser.objects.create_user(
            username="training-owner",
            email="training-owner@example.com",
            password="valid-test-password-123",
        )
        self.user = CustomUser.objects.create_user(
            username="training-user",
            email="training-user@example.com",
            password="valid-test-password-123",
        )
        self.job = Job.objects.create(
            title="Analyst",
            description="Analyze data.",
            skills_required="Data analysis",
            created_by=self.owner,
        )

    def test_training_dataset_uses_only_explicit_human_decisions(self):
        Application.objects.create(
            applicant=self.user,
            job=self.job,
            resume="applications/auto-selected.pdf",
            status="selected",
        )
        Application.objects.create(
            applicant=self.user,
            job=Job.objects.create(
                title="Reviewed role",
                description="Reviewed application.",
                skills_required="Analysis",
                created_by=self.owner,
            ),
            resume="applications/human-selected.pdf",
            status="selected",
            human_reviewed=True,
        )
        Application.objects.create(
            applicant=self.user,
            job=Job.objects.create(
                title="Rejected role",
                description="Rejected application.",
                skills_required="Writing",
                created_by=self.owner,
            ),
            resume="applications/human-rejected.pdf",
            status="rejected",
            human_reviewed=True,
        )

        texts, labels, numeric, groups = build_dataset()

        self.assertEqual(labels.tolist(), [1, 0])
        self.assertEqual(len(texts), 2)
        self.assertEqual(numeric.shape, (2, 6))
        self.assertEqual(groups.tolist(), [self.user.id, self.user.id])

    def test_trainer_rejects_insufficient_decisions(self):
        with self.assertRaisesRegex(ValueError, "at least 20"):
            _validate_dataset(labels=[], groups=[])
