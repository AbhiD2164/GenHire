from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np
from django.conf import settings
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from jobs.models import Job
from .matching_features import build_job_features, build_profile_features


ARTIFACT_VERSION = 2


class Recommender:
    def __init__(self):
        self.artifact = None
        artifact_path = Path(settings.ML_MODEL_DIR) / "recommender_v2.joblib"
        if artifact_path.exists():
            artifact = joblib.load(artifact_path)
            if not isinstance(artifact, dict):
                raise ValueError(f"Invalid recommender artifact at {artifact_path}.")
            if artifact.get("format_version") == ARTIFACT_VERSION:
                if (
                    artifact.get("numeric_feature_count") != 6
                    or "classifier" not in artifact
                    or "vectorizer" not in artifact
                ):
                    raise ValueError(f"Incomplete recommender artifact at {artifact_path}.")
                self.artifact = artifact

    def available(self):
        return self.artifact is not None

    def recommend_for_user(self, user, top_k=10, exclude_job_ids=None):
        jobs = list(
            Job.objects.filter(is_active=True)
            .exclude(id__in=exclude_job_ids or [])
            .order_by("-created_at")
        )
        if not jobs:
            return []

        profile_features = build_profile_features(user)
        job_features = [build_job_features(job, profile_features) for job in jobs]

        if self.artifact:
            vectorizer = self.artifact["vectorizer"]
            model = self.artifact["classifier"]
            text_matrix = vectorizer.transform([features["document"] for features in job_features])
            numeric_matrix = np.asarray(
                [features["numeric_features"] for features in job_features], dtype=float
            )
            from scipy import sparse

            model_inputs = sparse.hstack(
                [text_matrix, sparse.csr_matrix(numeric_matrix)], format="csr"
            )
            scores = model.predict_proba(model_inputs)[:, 1]
            method = "trained_ml"
        else:
            documents = [profile_features["document"]] + [
                features["job_document"] for features in job_features
            ]
            vectorizer = TfidfVectorizer(
                max_features=5000, ngram_range=(1, 2), stop_words="english"
            )
            matrix = vectorizer.fit_transform(documents)
            similarities = cosine_similarity(matrix[0:1], matrix[1:]).ravel()
            scores = np.asarray([
                0.55 * features["required_skill_coverage"]
                + 0.15 * features["preferred_skill_coverage"]
                + 0.15 * features["experience_coverage"]
                + 0.05 * features["education_coverage"]
                + 0.10 * similarity
                for features, similarity in zip(job_features, similarities)
            ])
            method = "content_similarity"

        ranked = sorted(
            zip(jobs, job_features, scores),
            key=lambda item: float(item[2]),
            reverse=True,
        )[:top_k]
        results = []
        for job, features, score in ranked:
            reasons = []
            if features["matched_skills"]:
                reasons.append(f"Matching skills: {', '.join(features['matched_skills'][:4])}")
            if features["experience_coverage"] >= 1:
                reasons.append("Meets the minimum experience requirement")
            if features["education_coverage"] > 0:
                reasons.append("Education details align with the stated requirement")
            results.append({
                "id": job.id,
                "title": job.title,
                "company_name": job.company_name,
                "location": job.location,
                "work_mode": job.work_mode,
                "industry": job.industry,
                "match_type": method,
                "recommendation_method": method,
                "match_score": round(float(score), 4),
                "reason": "; ".join(reasons) or (
                    "Ranked by your profile and the role requirements."
                    if method == "trained_ml"
                    else "Based on profile and job-description similarity."
                ),
                "matched_skills": features["matched_skills"],
            })
        return results


@lru_cache(maxsize=1)
def get_recommender():
    return Recommender()
