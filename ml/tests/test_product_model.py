"""Real artifact, preprocessing and split checks; never retrain during tests."""
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from predict_product import DEFAULT_ARTIFACT, MODEL_COLUMNS, SensoryPredictor
from product_profiles import FEATURES, PRODUCTS
from train_product_reformulation import dataset


class ProductModelTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.predictor = SensoryPredictor()
        cls.product_id = PRODUCTS[0]["product_id"]
        cls.baseline = {f["key"]: f["baseline"] for f in PRODUCTS[0]["factors"]}

    def test_input_order_and_percent_normalization(self):
        frame = self.predictor.input_frame(self.product_id, self.baseline)
        self.assertEqual(list(frame.columns), MODEL_COLUMNS)
        np.testing.assert_allclose(frame[MODEL_COLUMNS[2:]].to_numpy(dtype=float), [[.4, 8/15, .44]])
        for bad in (True, "4", None, float("nan"), float("inf"), -1, 10.1):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                self.predictor.input_frame(self.product_id, {**self.baseline, FEATURES[0]: bad})
        with self.assertRaises(ValueError):
            self.predictor.input_frame("unknown", self.baseline)
        with self.assertRaises(ValueError):
            self.predictor.input_frame(self.product_id, {**self.baseline, "water_pct": 80})

    def test_synthetic_dataset_reproducibility_and_split_isolation(self):
        first, second = dataset(), dataset()
        self.assertTrue(first.equals(second))
        self.assertEqual(len(first), 2112)
        self.assertEqual(first.product_id.nunique(), 22)
        self.assertEqual(first.category_id.nunique(), 11)
        self.assertFalse(first.is_empirical_ground_truth.any())
        self.assertTrue(first.row_id.is_unique)
        manifest = json.loads((DEFAULT_ARTIFACT / "split_manifest.json").read_text(encoding="utf-8"))
        development, holdout = set(manifest["development_row_ids"]), set(manifest["holdout_row_ids"])
        self.assertFalse(development & holdout)
        self.assertEqual(development | holdout, set(first.row_id))
        for product_id in first.product_id.unique():
            ids = set(first.loc[first.product_id.eq(product_id), "row_id"])
            self.assertTrue(ids & development)
            self.assertTrue(ids & holdout)

    def test_real_fixture_and_batch_scalar_consistency(self):
        fixture = json.loads((DEFAULT_ARTIFACT / "prediction_example.json").read_text(encoding="utf-8"))
        result = self.predictor.predict(fixture["input"]["product_id"], fixture["input"]["composition"])
        np.testing.assert_allclose(list(result["predicted_responses"].values()),
                                   list(fixture["expected_output"].values()), rtol=fixture["rtol"], atol=fixture["atol"])
        import pandas as pd
        batch = self.predictor.predict_batch(self.product_id, pd.DataFrame([self.baseline, self.baseline]))
        np.testing.assert_allclose(batch[0], batch[1])
        np.testing.assert_allclose(batch[0], list(result["predicted_responses"].values()))

    def test_missing_or_changed_artifact_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(FileNotFoundError):
                SensoryPredictor(directory)
            target = Path(directory)
            for name in ("model_metadata.json", "product_catalog.json", "sensory_model.joblib"):
                shutil.copy2(DEFAULT_ARTIFACT / name, target / name)
            (target / "product_catalog.json").write_bytes(b"{}")
            with self.assertRaisesRegex(ValueError, "Catalog checksum"):
                SensoryPredictor(target)


if __name__ == "__main__":
    unittest.main()
