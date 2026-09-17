"""Cached, trusted model loading; no training code imported."""
from functools import lru_cache
import hashlib
import json
from pathlib import Path
from threading import Lock

import numpy as np
from Hackathon.rescue import RescueEngine
from ml.predict_product import SensoryPredictor, DEFAULT_ARTIFACT

ROOT = Path(__file__).resolve().parents[1]
_rescue_lock = Lock()
_sensory_lock = Lock()

@lru_cache(maxsize=1)
def _cached_rescue():
    engine=RescueEngine()
    engine.model.set_params(n_jobs=2)
    # Actual artifact inference, not merely file presence or HTTP liveness.
    prediction=engine.model.predict_proba(engine.data[engine.feature_columns].iloc[:1])
    if prediction.shape!=(1,2) or not np.isfinite(prediction).all(): raise ValueError('Invalid rescue model output')
    return engine

def load_rescue():
    # lru_cache alone can duplicate first-load work on concurrent cache misses.
    with _rescue_lock:
        return _cached_rescue()

@lru_cache(maxsize=1)
def rescue_versions():
    folder=ROOT/'Hackathon'
    return {'model_version':'xgboost-sha256-'+hashlib.sha256((folder/'ml/artifacts/stability_model.json').read_bytes()).hexdigest(),
            'catalog_version':'catalog-sha256-'+hashlib.sha256((folder/'data/processed/formulations_clean.csv').read_bytes()).hexdigest()}

@lru_cache(maxsize=1)
def _cached_sensory():
    predictor=SensoryPredictor()
    fixture=json.loads((DEFAULT_ARTIFACT/'prediction_example.json').read_text(encoding='utf-8'))
    actual=predictor.predict(fixture['input']['product_id'],fixture['input']['composition'])['predicted_responses']
    np.testing.assert_allclose(list(actual.values()),list(fixture['expected_output'].values()),rtol=fixture['rtol'],atol=fixture['atol'])
    return predictor

def load_sensory():
    with _sensory_lock:
        return _cached_sensory()
