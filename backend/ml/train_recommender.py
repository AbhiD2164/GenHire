"""Train a simple job recommendation model using existing applications.

Run this script from the repo root (where manage.py lives):

    python backend/ml/train_recommender.py

It will write `recommender_model.joblib` and `recommender_vectorizer.joblib`
into the `ML_MODEL_DIR` defined in Django settings.
"""
import os
import random
import logging

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "GenHire.settings")
django.setup()

from django.conf import settings
from jobs.models import Job, Application
from accounts.models import CustomUser
from accounts.models import WorkExperience
from network.models import Post

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
import xgboost as xgb
import joblib
import numpy as np
import json

try:
    from sentence_transformers import SentenceTransformer
    STRANS_AVAILABLE = True
except Exception:
    STRANS_AVAILABLE = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _user_skills(user):
    try:
        profile = user.profile
        return profile.skills or ""
    except Exception:
        return ""


def _user_text_and_features(user):
    """Return (text, numeric_features) for a user."""
    try:
        profile = user.profile
    except Exception:
        profile = None

    skills = (profile.skills or "") if profile else ""
    headline = (profile.headline or "") if profile else ""
    bio = (profile.bio or "") if profile else ""

    # experiences
    exp_texts = []
    total_months = 0
    if profile and hasattr(profile, "experiences"):
        for e in profile.experiences.all():
            parts = [e.job_title or "", e.company or ""]
            exp_texts.append(" ".join([p for p in parts if p]))
            if e.start_year and (e.end_year or e.is_current):
                s_year = e.start_year or 0
                e_year = e.end_year or (s_year)
                months = ((e_year - s_year) * 12) if e_year and s_year else 0
                total_months += max(0, months)

    # fallback to profile.total_experience_months
    if profile and profile.total_experience_months:
        total_months = max(total_months, profile.total_experience_months)

    # project posts
    project_texts = []
    try:
        posts = Post.objects.filter(author=user, post_type="project").order_by("-created_at")[:10]
        for p in posts:
            project_texts.append(p.content or "")
    except Exception:
        posts = []

    text_parts = [skills, headline, bio, " ".join(exp_texts), " ".join(project_texts)]
    text = " ".join([t for t in text_parts if t]).strip()

    # numeric features: total_experience_months (scaled), project_count (capped)
    project_count = len(project_texts)
    feat_months = float(total_months or 0)
    feat_project_count = float(min(project_count, 20))

    return text, [feat_months, feat_project_count]


def _job_skills(job):
    return " ".join(filter(None, [job.skills_required, job.good_to_have]))


def build_dataset(negative_ratio=2):
    logger.info("Building dataset from applications and job listings")

    positives = []
    for app in Application.objects.filter(status__in=("selected", "consider")).select_related("applicant", "job"):
        user = app.applicant
        job = app.job
        positives.append((user.id, job.id))

    logger.info(f"Found {len(positives)} positive examples")

    # gather all users and jobs
    users = list(CustomUser.objects.filter(role="applicant"))
    jobs = list(Job.objects.filter(is_active=True))

    # make a set for positives for quick lookup
    pos_set = set(positives)

    X_texts = []
    y = []
    numeric_feats = []

    # add positives
    for (uid, jid) in positives:
        user = CustomUser.objects.get(pk=uid)
        job = Job.objects.get(pk=jid)
        user_text, feats = _user_text_and_features(user)
        text = (user_text + " " + _job_skills(job) + " " + (job.title or "") + " " + (job.description or "")).strip()
        X_texts.append(text)
        numeric_feats.append(feats)
        y.append(1)

    # sample some negatives
    neg_needed = max(1, len(positives) * negative_ratio)
    sampled = 0
    attempts = 0
    while sampled < neg_needed and attempts < neg_needed * 10:
        attempts += 1
        user = random.choice(users)
        job = random.choice(jobs)
        if (user.id, job.id) in pos_set:
            continue
        user_text, feats = _user_text_and_features(user)
        text = (user_text + " " + _job_skills(job) + " " + (job.title or "") + " " + (job.description or "")).strip()
        X_texts.append(text)
        numeric_feats.append(feats)
        y.append(0)
        sampled += 1

    logger.info(f"Built dataset with {len(X_texts)} examples ({sum(y)} positives)")
    return X_texts, np.array(y), np.array(numeric_feats)


def train_and_save():
    X_texts, y, numeric_feats = build_dataset()

    if not len(X_texts):
        logger.error("No training data available. Run after collecting some applications.")
        return

    vectorizer = TfidfVectorizer(max_features=2000)
    X_text = vectorizer.fit_transform(X_texts)

    # normalize numeric features: months scaled to [0,1] by 240 months (20 years), project_count scaled by 20
    if numeric_feats.size == 0:
        numeric_feats = np.zeros((X_text.shape[0], 2))
    else:
        numeric_feats = numeric_feats.astype(float)
        numeric_feats[:, 0] = np.clip(numeric_feats[:, 0] / 240.0, 0.0, 1.0)
        numeric_feats[:, 1] = numeric_feats[:, 1] / 20.0

    from scipy import sparse
    X = sparse.hstack([X_text, sparse.csr_matrix(numeric_feats)], format="csr")

    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    logger.info("Training XGBoost classifier...")
    model = xgb.XGBClassifier(use_label_encoder=False, eval_metric="logloss", n_estimators=200, max_depth=6)
    # XGBoost expects dense inputs for sklearn wrapper — convert if sparse
    try:
        model.fit(X_train, y_train)
    except Exception:
        model.fit(X_train.toarray(), y_train)

    # evaluate
    preds = model.predict_proba(X_val)[:, 1]
    try:
        from sklearn.metrics import roc_auc_score
        auc = roc_auc_score(y_val, preds)
        logger.info(f"Validation AUC: {auc:.4f}")
    except Exception:
        pass

    model_dir = settings.ML_MODEL_DIR
    model_dir.mkdir(parents=True, exist_ok=True)

    model_path = model_dir / "recommender_model_v1.joblib"
    vec_path = model_dir / "recommender_vectorizer_v1.joblib"

    joblib.dump(model, str(model_path))
    joblib.dump(vectorizer, str(vec_path))
    # save schema info for numeric features
    meta = {"numeric_features": ["total_experience_months_scaled", "project_count_scaled"]}
    with open(str(model_dir / "recommender_meta.json"), "w", encoding="utf-8") as mf:
        json.dump(meta, mf)

    logger.info(f"Saved model to {model_path}")
    logger.info(f"Saved vectorizer to {vec_path}")

    # If sentence-transformers is available, compute job embeddings for fast similarity ranking
    if STRANS_AVAILABLE:
        logger.info("Computing job embeddings using sentence-transformers...")
        s_model = SentenceTransformer("all-MiniLM-L6-v2")
        jobs = list(Job.objects.filter(is_active=True))
        job_texts = [(_job_skills(j) + " " + (j.title or "") + " " + (j.description or "")).strip() for j in jobs]
        if job_texts:
            embeddings = s_model.encode(job_texts, show_progress_bar=True)
            emb_path = model_dir / "job_embeddings_v1.npy"
            ids_path = model_dir / "job_ids_v1.json"
            np.save(str(emb_path), embeddings)
            with open(str(ids_path), "w", encoding="utf-8") as f:
                json.dump([j.id for j in jobs], f)
            logger.info(f"Saved job embeddings to {emb_path} and ids to {ids_path}")


if __name__ == "__main__":
    train_and_save()
