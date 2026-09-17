"""Real saved-model tests; fault injection checks errors, never fake success."""
import json
import unittest
from unittest.mock import patch

import numpy as np
from fastapi.testclient import TestClient
from backend.main import app, MAX_BODY, slots
from backend.predictor import load_sensory
from ml.predict_mercurio import DEFAULT_ARTIFACT

BASE = {'phytantriol_pct': 1.5, 'soy_lecithin_pct': 2.5, 'cct_pct': 3.0}
SEARCH = {'baseline': BASE, 'target_constraints': {
    'hydration_ratio_min': 1.55, 'stickiness_score_0_10_max': 3.5,
    'consistency_index_min': 28000.0, 'consistency_index_max': 33000.0}}
RESCUE = {'formula_id': 7, 'constraint': {
    'type': 'ingredient_unavailable', 'ingredient': 'Plantacare 818'}, 'top_k': 3}


class APITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app, raise_server_exceptions=False)

    def test_health_is_liveness_not_model_readiness(self):
        with patch('backend.main.load_sensory', side_effect=FileNotFoundError('private/path')):
            self.assertEqual(self.client.get('/health').status_code, 200)
            r = self.client.get('/ready')
            self.assertEqual(r.status_code, 503)
            self.assertEqual(r.json()['engines']['formula_rescue']['status'], 'ready')
            self.assertNotIn('private', r.text)
            self.assertEqual(self.client.get('/formulas?limit=1').status_code, 200)

    def test_readiness_runs_both_real_models(self):
        r = self.client.get('/ready')
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()['engines']['ai_reformulation']['model_version'],
                         'mercurio_polynomial_ridge_v1')
        self.assertTrue(r.json()['engines']['formula_rescue']['model_version'].startswith('xgboost-sha256-'))

    def test_rescue_catalog_and_original_top_three_unchanged(self):
        catalog = self.client.get('/formulas?limit=1').json()
        self.assertEqual(catalog['total'], 294)
        self.assertEqual(catalog['count'], 1)
        r = self.client.post('/reformulate', json=RESCUE)
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()
        self.assertEqual([c['formula_id'] for c in data['candidates']], [288, 292, 190])
        self.assertTrue(all(c['constraint_passed'] for c in data['candidates']))
        self.assertEqual(data['catalog_version'], catalog['catalog_version'])
        self.assertIn('model_version', data)
        self.assertEqual(data['disclaimer'],
            'Predicted / estimated and requires physical laboratory validation.')

    def test_real_prediction_matches_saved_fixture(self):
        fixture = json.loads((DEFAULT_ARTIFACT/'prediction_example.json').read_text())
        r = self.client.post('/ai-reformulation/predict', json={'composition': fixture['input']})
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()
        np.testing.assert_allclose(list(data['predicted_responses'].values()),
            list(fixture['expected_output'].values()), rtol=fixture['rtol'], atol=fixture['atol'])
        self.assertEqual(data['data_origin'], 'MODEL_GENERATED_PUBLISHED_EQUATION')
        self.assertEqual(data['model_version'], 'mercurio_polynomial_ridge_v1')

    def test_optimizer_real_feasible_deterministic_and_scalar_consistent(self):
        r = self.client.post('/ai-reformulation/optimize', json=SEARCH)
        self.assertEqual(r.status_code, 200, r.text)
        result = r.json()
        self.assertEqual(result, self.client.post('/ai-reformulation/optimize', json=SEARCH).json())
        self.assertEqual(result['process']['sampled_count'], 10000)
        self.assertEqual(len(result['candidates']), 3)
        distances = [c['normalized_change_distance'] for c in result['candidates']]
        self.assertEqual(distances, sorted(distances))
        for candidate in result['candidates']:
            self.assertTrue(all(candidate['constraint_checks'].values()))
            self.assertNotEqual(candidate['composition'], BASE)
            scalar = load_sensory().predict(candidate['composition'])['predicted_responses']
            np.testing.assert_allclose(list(candidate['predicted_responses'].values()),
                                       list(scalar.values()), rtol=1e-10, atol=1e-9)
        widths = np.array([3., 3., 5.])
        for i, a in enumerate(result['candidates']):
            for b in result['candidates'][i+1:]:
                distance = np.linalg.norm((np.array(list(a['composition'].values()))-
                    np.array(list(b['composition'].values())))/widths)
                self.assertGreaterEqual(distance, SEARCH.get('min_distance', .03))

    def test_fixed_factor_and_custom_bounds_preserved(self):
        payload = {**SEARCH, 'fixed': ['cct_pct'], 'bounds': {
            'soy_lecithin_pct': {'min': 2.0, 'max': 3.0}}}
        data = self.client.post('/ai-reformulation/optimize', json=payload).json()
        self.assertGreater(len(data['candidates']), 0)
        for candidate in data['candidates']:
            self.assertEqual(candidate['composition']['cct_pct'], 3.)
            self.assertTrue(2 <= candidate['composition']['soy_lecithin_pct'] <= 3)

    def test_all_fixed_returns_empty_not_baseline_as_alternative(self):
        payload = {**SEARCH, 'fixed': list(BASE)}
        r = self.client.post('/ai-reformulation/optimize', json=payload)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()['candidates'], [])
        self.assertEqual(r.json()['process']['sampled_count'], 1)
        self.assertEqual(r.json()['status'], 'NO_FEASIBLE_ALTERNATIVE_FOUND')

    def test_equal_bounds_work_without_sampling_zero_width(self):
        payload = {**SEARCH, 'bounds': {'phytantriol_pct': {'min': 1.5, 'max': 1.5}}}
        r = self.client.post('/ai-reformulation/optimize', json=payload)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertTrue(all(c['composition']['phytantriol_pct'] == 1.5 for c in r.json()['candidates']))

    def test_unreachable_target_has_no_near_miss_fallback(self):
        r = self.client.post('/ai-reformulation/optimize', json={
            'baseline': BASE, 'target_constraints': {'hydration_ratio_min': 1.6}})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()['candidates'], [])
        self.assertEqual(r.json()['process']['feasible_alternative_count'], 0)

    def test_predict_rejects_bad_types_ranges_missing_and_extra_fields(self):
        for value in ('1.5', True, -1, 3.1, None):
            with self.subTest(value=value):
                composition = {**BASE, 'phytantriol_pct': value}
                self.assertEqual(self.client.post('/ai-reformulation/predict',
                    json={'composition': composition}).status_code, 422)
        for composition in ({**BASE, 'water_pct': 90}, {'cct_pct': 3}):
            self.assertEqual(self.client.post('/ai-reformulation/predict',
                json={'composition': composition}).status_code, 422)

    def test_nonfinite_inputs_are_rejected_without_serialization_failure(self):
        for value in ('NaN', 'Infinity', '-Infinity'):
            body = '{"composition":{"phytantriol_pct":'+value+',"soy_lecithin_pct":2.5,"cct_pct":3}}'
            r = self.client.post('/ai-reformulation/predict', content=body,
                                 headers={'Content-Type': 'application/json'})
            self.assertEqual(r.status_code, 422, r.text)
            self.assertNotIn('input', r.json()['detail'][0])

    def test_search_rejects_invalid_contract(self):
        updates = [
            {'target_constraints': {}}, {'target_constraints': {'unknown': 1.}},
            {'target_constraints': {'hydration_ratio_min': '1.55'}},
            {'target_constraints': {'hydration_ratio_min': 2., 'hydration_ratio_max': 1.}},
            {'target_constraints': {'stickiness_score_0_10_max': 11.}},
            {'fixed': ['cct_pct', 'cct_pct']}, {'fixed': ['unknown']},
            {'bounds': {'phytantriol_pct': {'min': 0., 'max': 4.}}},
            {'bounds': {'phytantriol_pct': {'min': 2., 'max': 3.}}},
            {'bounds': {'phytantriol_pct': {'min': 2., 'max': 1.}}},
            {'top_k': 4}, {'top_k': True}, {'seed': -1}, {'n_samples': 1000000}]
        for update in updates:
            with self.subTest(update=update):
                r = self.client.post('/ai-reformulation/optimize', json={**SEARCH, **update})
                self.assertEqual(r.status_code, 422, r.text)

    def test_rescue_domain_and_strict_validation(self):
        for update in ({'formula_id': 99999}, {'formula_id': True}, {'formula_id': '7'},
                       {'top_k': 11}, {'unexpected': 1}, {'constraint': {
                           'type': 'ingredient_unavailable', 'ingredient': 'unknown'}}):
            r = self.client.post('/reformulate', json={**RESCUE, **update})
            self.assertEqual(r.status_code, 422, r.text)
        self.assertEqual(self.client.get('/formulas?limit=101').status_code, 422)

    def test_missing_model_is_controlled_unavailable_not_fake_prediction(self):
        for name, path, payload in [('load_sensory', '/ai-reformulation/predict', {'composition': BASE}),
                                    ('load_rescue', '/reformulate', RESCUE)]:
            with patch('backend.main.'+name, side_effect=FileNotFoundError('SECRET/path')):
                r = self.client.post(path, json=payload)
                self.assertEqual(r.status_code, 503)
                self.assertNotIn('SECRET', r.text)
                self.assertNotIn('predicted_responses', r.json())

    def test_unexpected_error_is_sanitized(self):
        with patch.object(load_sensory(), 'predict', side_effect=RuntimeError('SECRET/path/traceback')):
            r = self.client.post('/ai-reformulation/predict', json={'composition': BASE},
                                 headers={'Origin': 'http://localhost:3000'})
            self.assertEqual(r.status_code, 500)
            self.assertEqual(r.json(), {'detail': 'Internal service error'})
            self.assertEqual(r.headers.get('access-control-allow-origin'), 'http://localhost:3000')

    def test_model_instances_are_reused(self):
        from backend.predictor import load_rescue
        self.assertIs(load_sensory(), load_sensory())
        self.assertIs(load_rescue(), load_rescue())

    def test_invalid_model_response_is_sanitized_and_keeps_cors(self):
        with patch.object(load_sensory(), 'predict', return_value={'private': 'SECRET/path'}):
            r = self.client.post('/ai-reformulation/predict', json={'composition': BASE},
                                 headers={'Origin': 'http://localhost:3000'})
            self.assertEqual(r.status_code, 500)
            self.assertEqual(r.json(), {'detail': 'Internal service error'})
            self.assertEqual(r.headers.get('access-control-allow-origin'), 'http://localhost:3000')

    def test_capacity_returns_429_then_releases(self):
        self.assertTrue(slots.acquire(blocking=False))
        self.assertTrue(slots.acquire(blocking=False))
        try:
            self.assertEqual(self.client.post('/ai-reformulation/optimize', json=SEARCH).status_code, 429)
        finally:
            slots.release(); slots.release()
        self.assertEqual(self.client.post('/ai-reformulation/optimize', json=SEARCH).status_code, 200)

    def test_body_limits_content_type_and_malformed_json(self):
        r = self.client.post('/ai-reformulation/predict', content='x'*(MAX_BODY+1),
                             headers={'Content-Type': 'application/json', 'Origin': 'http://localhost:3000'})
        self.assertEqual(r.status_code, 413)
        self.assertEqual(r.headers.get('access-control-allow-origin'), 'http://localhost:3000')
        self.assertEqual(self.client.post('/ai-reformulation/predict', content='{}',
            headers={'Content-Type': 'text/plain'}).status_code, 415)
        self.assertEqual(self.client.post('/ai-reformulation/predict', content='{',
            headers={'Content-Type': 'application/json'}).status_code, 422)

    def test_cors_exact_origins_not_authentication(self):
        for origin, expected in [('http://localhost:3000', 200), ('https://unlisted.example', 400)]:
            r = self.client.options('/ai-reformulation/predict', headers={
                'Origin': origin, 'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'content-type'})
            self.assertEqual(r.status_code, expected)
        # Unlisted origins cannot read browser responses; direct requests are not authenticated.
        self.assertEqual(self.client.get('/health', headers={'Origin': 'https://unlisted.example'}).status_code, 200)


if __name__ == '__main__':
    unittest.main()
