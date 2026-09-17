"""Standalone trusted-artifact inference; never imports forward_model training code."""
import hashlib
import json
from numbers import Real
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
if __package__:
    from .preprocess_mercurio import ROOT, FEATURES, TARGETS, RANGES, DISCLAIMER
else:
    from preprocess_mercurio import ROOT, FEATURES, TARGETS, RANGES, DISCLAIMER

DEFAULT_ARTIFACT = ROOT / 'ml/artifacts/mercurio_polynomial_ridge_v1'


def input_frame(values):
    if not isinstance(values, dict) or set(values) != set(FEATURES.values()):
        raise ValueError('Provide exactly three concentration fields')
    for col, (lo, hi) in RANGES.items():
        value = values[col]
        if isinstance(value, (bool, np.bool_)) or not isinstance(value, Real) or not np.isfinite(value) or not lo <= value <= hi:
            raise ValueError(f'{col} must be a finite numeric concentration within {lo}–{hi}%')
    return pd.DataFrame([values], columns=list(FEATURES.values()))


class SensoryPredictor:
    def __init__(self, artifact_dir=DEFAULT_ARTIFACT):
        artifact_dir = Path(artifact_dir)
        self.metadata = json.loads((artifact_dir / 'model_metadata.json').read_text(encoding='utf-8'))
        path = artifact_dir / 'sensory_model.joblib'
        if hashlib.sha256(path.read_bytes()).hexdigest() != self.metadata['model_sha256']:
            raise ValueError('Artifact checksum mismatch')
        if self.metadata['feature_order'] != list(FEATURES.values()) or self.metadata['target_order'] != TARGETS:
            raise ValueError('Artifact feature/target contract mismatch')
        self.model = joblib.load(path)  # Trusted team-produced artifact only; checksum is not authentication.

    def predict(self, values):
        prediction = np.asarray(self.model.predict(input_frame(values)))
        if prediction.shape != (1, 4) or not np.isfinite(prediction).all() or (prediction < 0).any() or (prediction[0, 1:3] > 10).any():
            raise ValueError('Predicted responses outside supported physical bounds')
        return {'model_version': self.metadata['model_version'], 'predicted_responses': dict(zip(TARGETS, prediction[0].tolist())),
                'data_origin': self.metadata['data_origin'], 'disclaimer': DISCLAIMER}


if __name__ == '__main__':
    fixture = json.loads((DEFAULT_ARTIFACT / 'prediction_example.json').read_text(encoding='utf-8'))
    result = SensoryPredictor().predict(fixture['input'])
    np.testing.assert_allclose(list(result['predicted_responses'].values()), list(fixture['expected_output'].values()), rtol=fixture['rtol'], atol=fixture['atol'])
    print(json.dumps(result, indent=2))
