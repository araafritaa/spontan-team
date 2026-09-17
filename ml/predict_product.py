"""Trusted product-aware model loader and strict percent-to-ratio preprocessing."""
import hashlib
import json
from numbers import Real
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

if __package__:
    from .product_profiles import DISCLAIMER, FEATURES, TARGETS
else:
    from product_profiles import DISCLAIMER, FEATURES, TARGETS

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ARTIFACT = ROOT / "ml/artifacts/synthetic_product_polynomial_ridge_v1"
MODEL_COLUMNS = ["product_id", "category_id", "factor_a_ratio", "factor_b_ratio", "factor_c_ratio"]


class SensoryPredictor:
    def __init__(self, artifact_dir=DEFAULT_ARTIFACT):
        artifact_dir = Path(artifact_dir)
        self.metadata = json.loads((artifact_dir / "model_metadata.json").read_text(encoding="utf-8"))
        self.catalog_document = json.loads((artifact_dir / "product_catalog.json").read_text(encoding="utf-8"))
        path = artifact_dir / "sensory_model.joblib"
        if hashlib.sha256(path.read_bytes()).hexdigest() != self.metadata["model_sha256"]:
            raise ValueError("Artifact checksum mismatch")
        if hashlib.sha256((artifact_dir / "product_catalog.json").read_bytes()).hexdigest() != self.metadata["catalog_sha256"]:
            raise ValueError("Catalog checksum mismatch")
        if self.metadata["model_input_order"] != MODEL_COLUMNS or self.metadata["api_feature_order"] != FEATURES or self.metadata["target_order"] != TARGETS:
            raise ValueError("Artifact feature/target contract mismatch")
        self.products = {row["product_id"]: row for row in self.catalog_document["products"]}
        self.model = joblib.load(path)  # Trusted team-produced artifact only.

    def catalog(self):
        return self.catalog_document

    def profile(self, product_id):
        try:
            return self.products[product_id]
        except KeyError:
            raise ValueError("Unknown product_id") from None

    def input_frame(self, product_id, values):
        profile = self.profile(product_id)
        if not isinstance(values, dict) or set(values) != set(FEATURES):
            raise ValueError("Provide exactly three concentration fields")
        row = {"product_id": product_id, "category_id": profile["category_id"]}
        for letter, feature, factor in zip("abc", FEATURES, profile["factors"]):
            value = values[feature]
            if isinstance(value, (bool, np.bool_)) or not isinstance(value, Real) or not np.isfinite(value):
                raise ValueError(f"{feature} must be finite numeric")
            if not factor["min"] <= value <= factor["max"]:
                raise ValueError(f"{feature} outside selected product profile")
            row[f"factor_{letter}_ratio"] = value / factor["max"]
        return pd.DataFrame([row], columns=MODEL_COLUMNS)

    def predict_batch(self, product_id, frame):
        profile = self.profile(product_id)
        values = frame[FEATURES].to_numpy(dtype=float)
        lows = np.array([f["min"] for f in profile["factors"]])
        highs = np.array([f["max"] for f in profile["factors"]])
        if not np.isfinite(values).all() or (values < lows).any() or (values > highs).any():
            raise ValueError("Batch outside selected product profile")
        model_frame = pd.DataFrame(values / highs, columns=MODEL_COLUMNS[2:])
        model_frame["product_id"] = product_id
        model_frame["category_id"] = profile["category_id"]
        prediction = np.asarray(self.model.predict(model_frame[MODEL_COLUMNS]), dtype=float)
        if prediction.shape != (len(frame), len(TARGETS)) or not np.isfinite(prediction).all() or (prediction < 0).any() or (prediction[:, 1:3] > 10).any():
            raise ValueError("Predicted responses outside supported bounds")
        return prediction

    def predict(self, product_id, values):
        prediction = np.asarray(self.model.predict(self.input_frame(product_id, values)), dtype=float)
        if prediction.shape != (1, len(TARGETS)) or not np.isfinite(prediction).all() or (prediction < 0).any() or (prediction[0, 1:3] > 10).any():
            raise ValueError("Predicted responses outside supported bounds")
        return {"model_version": self.metadata["model_version"], "product": self.profile(product_id),
                "predicted_responses": dict(zip(TARGETS, prediction[0].tolist())),
                "data_origin": self.metadata["data_origin"], "disclaimer": DISCLAIMER}


if __name__ == "__main__":
    fixture = json.loads((DEFAULT_ARTIFACT / "prediction_example.json").read_text(encoding="utf-8"))
    result = SensoryPredictor().predict(fixture["input"]["product_id"], fixture["input"]["composition"])
    np.testing.assert_allclose(list(result["predicted_responses"].values()), list(fixture["expected_output"].values()), rtol=fixture["rtol"], atol=fixture["atol"])
    print(json.dumps(result, indent=2, ensure_ascii=False))
