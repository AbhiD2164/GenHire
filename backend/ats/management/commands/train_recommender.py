from django.core.management.base import BaseCommand
from django.conf import settings

import joblib
import numpy as np
import json

from ml import train_recommender


class Command(BaseCommand):
    help = "Train the recommender model and print a short evaluation report."

    def add_arguments(self, parser):
        parser.add_argument("--no-embeddings", action="store_true", help="Skip building/loading sentence-transformer embeddings")

    def handle(self, *args, **options):
        self.stdout.write("Starting recommender training...")
        train_recommender.train_and_save()

        model_dir = settings.ML_MODEL_DIR
        model_path = model_dir / "recommender_model_v1.joblib"
        vec_path = model_dir / "recommender_vectorizer_v1.joblib"

        if not model_path.exists() or not vec_path.exists():
            self.stderr.write("Model or vectorizer not found after training.")
            return

        model = joblib.load(str(model_path))
        vectorizer = joblib.load(str(vec_path))

        # attempt to build evaluation dataset
        X_texts, y, numeric_feats = train_recommender.build_dataset()
        if not len(X_texts):
            self.stdout.write("No evaluation data available (not enough applications).")
            return

        # prepare features as trainer does
        X_text = vectorizer.transform(X_texts)
        # normalize numeric feats same as trainer
        if numeric_feats.size == 0:
            numeric_feats = np.zeros((X_text.shape[0], 2))
        else:
            numeric_feats = numeric_feats.astype(float)
            numeric_feats[:, 0] = np.clip(numeric_feats[:, 0] / 240.0, 0.0, 1.0)
            numeric_feats[:, 1] = numeric_feats[:, 1] / 20.0
        from scipy import sparse
        X = sparse.hstack([X_text, sparse.csr_matrix(numeric_feats)], format="csr")

        try:
            preds = model.predict_proba(X)[:, 1]
        except Exception:
            preds = model.predict_proba(X.toarray())[:, 1]

        # AUC
        try:
            from sklearn.metrics import roc_auc_score
            auc = roc_auc_score(y, preds)
            self.stdout.write(f"Validation AUC: {auc:.4f}")
        except Exception:
            self.stdout.write("Could not compute AUC (insufficient labels or sklearn missing)")

        # feature importances (XGBoost)
        try:
            booster = model.get_booster()
            fmap = booster.get_score(importance_type="gain")
            # map feature names: tfidf features + two numeric features at the end
            try:
                tf_names = vectorizer.get_feature_names_out()
            except Exception:
                tf_names = []

            # build name map
            name_map = {}
            for k, v in fmap.items():
                # k like 'f123'
                if k.startswith("f") and k[1:].isdigit():
                    idx = int(k[1:])
                    if idx < len(tf_names):
                        name = tf_names[idx]
                    else:
                        # numeric features
                        if idx == len(tf_names):
                            name = "total_experience_months_scaled"
                        elif idx == len(tf_names) + 1:
                            name = "project_count_scaled"
                        else:
                            name = k
                else:
                    name = k
                name_map[name] = v

            # top features
            top = sorted(name_map.items(), key=lambda x: x[1], reverse=True)[:15]
            self.stdout.write("Top model features (gain):")
            for n, sc in top:
                self.stdout.write(f"  {n}: {sc:.4f}")
        except Exception as e:
            self.stdout.write("Could not extract feature importances: %s" % str(e))

        # if embeddings exists, report count
        emb_path = model_dir / "job_embeddings_v1.npy"
        ids_path = model_dir / "job_ids_v1.json"
        if emb_path.exists() and ids_path.exists():
            try:
                emb = np.load(str(emb_path))
                with open(str(ids_path), "r", encoding="utf-8") as f:
                    ids = json.load(f)
                self.stdout.write(f"Job embeddings present: {emb.shape[0]} jobs, dim={emb.shape[1]}")
            except Exception:
                self.stdout.write("Job embeddings present but could not be loaded.")
