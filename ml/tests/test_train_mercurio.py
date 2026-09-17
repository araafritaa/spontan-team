import sys
from pathlib import Path
import tempfile
import unittest

import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from predict_mercurio import SensoryPredictor, input_frame, DEFAULT_ARTIFACT
from train_mercurio import metrics


class TrainingTests(unittest.TestCase):
    def test_input_validation(self):
        good = {'phytantriol_pct': 1.5, 'soy_lecithin_pct': 2.5, 'cct_pct': 3}
        self.assertEqual(list(input_frame(good).columns), list(good))
        for value in [True, '1.5', None, float('nan'), float('inf'), -1, 3.1]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                input_frame({**good, 'phytantriol_pct': value})
        with self.assertRaises(ValueError): input_frame({**good, 'extra': 1})
        with self.assertRaises(ValueError): input_frame({'phytantriol_pct': 1})

    def test_missing_artifact(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(FileNotFoundError): SensoryPredictor(directory)

    def test_metrics_per_target(self):
        y = np.arange(20).reshape(5, 4)
        result = metrics(y, y)
        self.assertEqual(len(result), 4)
        self.assertTrue(all(m == {'mae': 0, 'rmse': 0, 'r2': 1} for m in result.values()))

    def test_real_exported_fixture(self):
        import json
        # Always checks the trained handover artifact, no fabricated fallback.
        fixture = json.loads((DEFAULT_ARTIFACT / 'prediction_example.json').read_text(encoding='utf-8'))
        result = SensoryPredictor().predict(fixture['input'])
        np.testing.assert_allclose(list(result['predicted_responses'].values()), list(fixture['expected_output'].values()), rtol=fixture['rtol'], atol=fixture['atol'])


if __name__ == '__main__': unittest.main()
