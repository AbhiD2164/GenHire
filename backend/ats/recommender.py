import json
from pathlib import Path

import joblib
import numpy as np
from django.conf import settings

from jobs.models import Job
from network.models import Post

# Lazy-loaded globals
SentenceTransformer = None
STRANS_AVAILABLE = None


class Recommender:
    def __init__(self):
        model_dir = Path(settings.ML_MODEL_DIR)

        self.model_path = model_dir / "recommender_model_v1.joblib"
        self.vec_path = model_dir / "recommender_vectorizer_v1.joblib"
        self.emb_path = model_dir / "job_embeddings_v1.npy"
        self.ids_path = model_dir / "job_ids_v1.json"

        self.model = None
        self.vectorizer = None
        self.st_model = None

        self.job_embeddings = None
        self.job_ids = None

        self._load()

    def _load_sentence_transformer(self):
        """
        Import SentenceTransformer only when actually needed.
        Prevents Django startup, migrations and runserver from
        loading PyTorch.
        """
        global SentenceTransformer, STRANS_AVAILABLE

        if STRANS_AVAILABLE is False:
            return None

        if SentenceTransformer is None:
            try:
                from sentence_transformers import SentenceTransformer as ST

                SentenceTransformer = ST
                STRANS_AVAILABLE = True

            except Exception:
                STRANS_AVAILABLE = False
                return None

        return SentenceTransformer

    def _load(self):
        """
        Load classical ML models.
        These are lightweight.
        """
        if self.model_path.exists() and self.vec_path.exists():
            try:
                self.model = joblib.load(self.model_path)
                self.vectorizer = joblib.load(self.vec_path)
            except Exception:
                self.model = None
                self.vectorizer = None

        """
        Load embedding files only if they exist.
        Import SentenceTransformer lazily.
        """
        if self.emb_path.exists() and self.ids_path.exists():

            ST = self._load_sentence_transformer()

            if ST is not None:
                try:
                    self.job_embeddings = np.load(self.emb_path)

                    with open(self.ids_path, "r", encoding="utf-8") as f:
                        self.job_ids = json.load(f)

                    self.st_model = ST("all-MiniLM-L6-v2")

                except Exception:
                    self.job_embeddings = None
                    self.job_ids = None
                    self.st_model = None

    def available(self):
        return self.model is not None or self.st_model is not None

    def _user_text_and_feats(self, user):
        try:
            profile = user.profile
        except Exception:
            profile = None

        skills = profile.skills if profile else ""
        headline = profile.headline if profile else ""
        bio = profile.bio if profile else ""

        experience = []
        total_months = 0

        if profile and hasattr(profile, "experiences"):

            for exp in profile.experiences.all():

                experience.append(
                    " ".join(
                        filter(
                            None,
                            [
                                getattr(exp, "job_title", ""),
                                getattr(exp, "company", ""),
                            ],
                        )
                    )
                )

                if getattr(exp, "start_year", None):

                    start = exp.start_year
                    end = exp.end_year or start

                    total_months += max(0, (end - start) * 12)

        if profile and getattr(profile, "total_experience_months", 0):
            total_months = max(
                total_months,
                profile.total_experience_months,
            )

        projects = []

        try:
            posts = (
                Post.objects.filter(author=user, post_type="project")
                .order_by("-created_at")[:10]
            )

            for p in posts:
                if p.content:
                    projects.append(p.content)

        except Exception:
            pass

        text = " ".join(
            filter(
                None,
                [
                    skills,
                    headline,
                    bio,
                    " ".join(experience),
                    " ".join(projects),
                ],
            )
        )

        features = [
            float(total_months),
            float(min(len(projects), 20)),
        ]

        return text, features

    def _job_skills(self, job):
        return " ".join(
            filter(
                None,
                [
                    getattr(job, "skills_required", ""),
                    getattr(job, "good_to_have", ""),
                ],
            )
        )

    def recommend_for_user(self, user, top_k=10):

        jobs = list(Job.objects.filter(is_active=True))

        if not jobs:
            return []

        user_text, features = self._user_text_and_feats(user)

        embedding_scores = None

        if (
            self.st_model is not None
            and self.job_embeddings is not None
        ):
            try:

                user_embedding = self.st_model.encode([user_text])[0]

                norms = (
                    np.linalg.norm(self.job_embeddings, axis=1)
                    * np.linalg.norm(user_embedding)
                )

                embedding_scores = (
                    self.job_embeddings @ user_embedding
                ) / (norms + 1e-12)

            except Exception:
                embedding_scores = None

        ml_scores = None

        if self.model is not None and self.vectorizer is not None:

            texts = [
                (
                    user_text
                    + " "
                    + self._job_skills(job)
                    + " "
                    + (job.title or "")
                    + " "
                    + (job.description or "")
                )
                for job in jobs
            ]

            X = self.vectorizer.transform(texts)

            from scipy import sparse

            numeric = np.array(features, dtype=float)

            numeric[0] = min(numeric[0] / 240.0, 1.0)
            numeric[1] = numeric[1] / 20.0

            numeric_matrix = np.tile(
                numeric,
                (len(jobs), 1),
            )

            X = sparse.hstack(
                [
                    X,
                    sparse.csr_matrix(numeric_matrix),
                ],
                format="csr",
            )

            try:
                ml_scores = self.model.predict_proba(X)[:, 1]

            except Exception:
                try:
                    ml_scores = self.model.predict_proba(
                        X.toarray()
                    )[:, 1]
                except Exception:
                    ml_scores = None

        recommendations = []

        for i, job in enumerate(jobs):

            score_ml = (
                float(ml_scores[i])
                if ml_scores is not None
                else 0
            )

            score_emb = (
                float(embedding_scores[i])
                if embedding_scores is not None
                else 0
            )

            if ml_scores is not None and embedding_scores is not None:
                score = 0.6 * score_ml + 0.4 * ((score_emb + 1) / 2)

            elif ml_scores is not None:
                score = score_ml

            elif embedding_scores is not None:
                score = (score_emb + 1) / 2

            else:
                score = 0

            recommendations.append(
                {
                    "id": job.id,
                    "title": job.title,
                    "company": job.company_name,
                    "score": round(float(score), 4),
                }
            )

        recommendations.sort(
            key=lambda x: x["score"],
            reverse=True,
        )

        return recommendations[:top_k]