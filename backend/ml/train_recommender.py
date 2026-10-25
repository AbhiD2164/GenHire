"""Train job matching from explicit human application decisions only."""
import os
from datetime import datetime, timezone

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "GenHire.settings")

import django

django.setup()

import joblib
import numpy as np
from django.conf import settings
from jobs.models import Application
from scipy import sparse
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import balanced_accuracy_score, roc_auc_score
from sklearn.model_selection import GroupShuffleSplit

from ats.matching_features import build_job_features, build_profile_features


MIN_SAMPLES = 20
MIN_SAMPLES_PER_CLASS = 5
MIN_USERS = 5
FEATURE_VERSION = 2


def build_dataset():
    applications = (
        Application.objects.filter(human_reviewed=True, status__in=("selected", "rejected"))
        .select_related("applicant", "job")
        .order_by("id")
    )
    texts = []
    labels = []
    numeric_features = []
    groups = []

    profile_cache = {}
    for application in applications:
        profile_features = profile_cache.get(application.applicant_id)
        if profile_features is None:
            profile_features = build_profile_features(application.applicant)
            profile_cache[application.applicant_id] = profile_features
        features = build_job_features(application.job, profile_features)
        texts.append(features["document"])
        numeric_features.append(features["numeric_features"])
        labels.append(1 if application.status == "selected" else 0)
        groups.append(application.applicant_id)

    return (
        texts,
        np.asarray(labels, dtype=int),
        np.asarray(numeric_features, dtype=float).reshape((-1, 6)),
        np.asarray(groups),
    )


def _validate_dataset(labels, groups):
    if len(labels) < MIN_SAMPLES:
        raise ValueError(
            f"Need at least {MIN_SAMPLES} explicitly reviewed applications; found {len(labels)}."
        )
    unique, counts = np.unique(labels, return_counts=True)
    counts_by_label = dict(zip(unique.tolist(), counts.tolist()))
    if any(counts_by_label.get(label, 0) < MIN_SAMPLES_PER_CLASS for label in (0, 1)):
        raise ValueError(
            "Need at least "
            f"{MIN_SAMPLES_PER_CLASS} human-rejected and {MIN_SAMPLES_PER_CLASS} "
            "human-selected applications."
        )
    if len(np.unique(groups)) < MIN_USERS:
        raise ValueError(f"Need reviewed outcomes from at least {MIN_USERS} distinct users.")


def _grouped_validation_split(features, labels, groups):
    splitter = GroupShuffleSplit(n_splits=50, test_size=0.2, random_state=42)
    for train_indices, validation_indices in splitter.split(features, labels, groups):
        if (
            len(np.unique(labels[train_indices])) == 2
            and len(np.unique(labels[validation_indices])) == 2
        ):
            return train_indices, validation_indices
    raise ValueError(
        "Could not create a user-separated validation split containing both outcomes. "
        "Collect human decisions across more users before training."
    )


def train_and_save():
    texts, labels, numeric_features, groups = build_dataset()
    _validate_dataset(labels, groups)

    train_indices, validation_indices = _grouped_validation_split(
        np.zeros((len(labels), 1)), labels, groups
    )
    validation_vectorizer = TfidfVectorizer(
        max_features=5000,
        min_df=1,
        ngram_range=(1, 2),
        stop_words="english",
    )
    validation_train_text = validation_vectorizer.fit_transform(
        [texts[index] for index in train_indices]
    )
    validation_test_text = validation_vectorizer.transform(
        [texts[index] for index in validation_indices]
    )
    validation_train = sparse.hstack(
        [
            validation_train_text,
            sparse.csr_matrix(numeric_features[train_indices]),
        ],
        format="csr",
    )
    validation_test = sparse.hstack(
        [
            validation_test_text,
            sparse.csr_matrix(numeric_features[validation_indices]),
        ],
        format="csr",
    )

    validation_model = LogisticRegression(
        max_iter=1000, class_weight="balanced", random_state=42
    )
    validation_model.fit(validation_train, labels[train_indices])
    validation_scores = validation_model.predict_proba(validation_test)[:, 1]
    validation_metrics = {
        "balanced_accuracy": float(balanced_accuracy_score(
            labels[validation_indices], validation_scores >= 0.5
        )),
        "roc_auc": float(roc_auc_score(labels[validation_indices], validation_scores)),
        "validation_users": int(len(np.unique(groups[validation_indices]))),
    }

    classifier = LogisticRegression(
        max_iter=1000, class_weight="balanced", random_state=42
    )
    vectorizer = TfidfVectorizer(
        max_features=5000,
        min_df=1,
        ngram_range=(1, 2),
        stop_words="english",
    )
    text_features = vectorizer.fit_transform(texts)
    features = sparse.hstack(
        [text_features, sparse.csr_matrix(numeric_features)], format="csr"
    )
    classifier.fit(features, labels)
    artifact = {
        "format_version": FEATURE_VERSION,
        "classifier": classifier,
        "vectorizer": vectorizer,
        "numeric_feature_count": 6,
        "training_samples": int(len(labels)),
        "training_users": int(len(np.unique(groups))),
        "validation_metrics": validation_metrics,
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }
    model_dir = settings.ML_MODEL_DIR
    model_dir.mkdir(parents=True, exist_ok=True)
    artifact_path = model_dir / "recommender_v2.joblib"
    joblib.dump(artifact, artifact_path)
    return artifact
