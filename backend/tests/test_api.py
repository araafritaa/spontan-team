"""Real saved-model tests; fault injection checks errors, never fake success."""
import json
import unittest
from unittest.mock import patch

import numpy as np
from fastapi.testclient import TestClient
from backend.main import app, MAX_BODY, slots
from backend.predictor import load_sensory
from ml.predict_product import DEFAULT_ARTIFACT

PRODUCT = 'wardah-lightening-day-cream'
BASE = {'factor_a_pct': 4.0, 'factor_b_pct': 8.0, 'factor_c_pct': 2.2}
SEARCH = {'product_id': PRODUCT, 'baseline': BASE, 'target_constraints': {
    'hydration_ratio_min': 1.25, 'stickiness_score_0_10_max': 4.5}}
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
                         'synthetic_product_polynomial_ridge_v1')
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
        r = self.client.post('/ai-reformulation/predict', json=fixture['input'])
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()
        np.testing.assert_allclose(list(data['predicted_responses'].values()),
            list(fixture['expected_output'].values()), rtol=fixture['rtol'], atol=fixture['atol'])
        self.assertEqual(data['data_origin'], 'SYNTHETIC_PROTOTYPE_DATA')
        self.assertEqual(data['model_version'], 'synthetic_product_polynomial_ridge_v1')

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
            scalar = load_sensory().predict(PRODUCT, candidate['composition'])['predicted_responses']
            np.testing.assert_allclose(list(candidate['predicted_responses'].values()),
                                       list(scalar.values()), rtol=1e-10, atol=1e-9)
        widths = np.array([10., 15., 5.])
        for i, a in enumerate(result['candidates']):
            for b in result['candidates'][i+1:]:
                distance = np.linalg.norm((np.array(list(a['composition'].values()))-
                    np.array(list(b['composition'].values())))/widths)
                self.assertGreaterEqual(distance, SEARCH.get('min_distance', .03))

    def test_fixed_factor_and_custom_bounds_preserved(self):
        payload = {**SEARCH, 'fixed': ['factor_c_pct'], 'bounds': {
            'factor_b_pct': {'min': 6.0, 'max': 15.0}}}
        data = self.client.post('/ai-reformulation/optimize', json=payload).json()
        self.assertGreater(len(data['candidates']), 0)
        for candidate in data['candidates']:
            self.assertEqual(candidate['composition']['factor_c_pct'], 2.2)
            self.assertTrue(6 <= candidate['composition']['factor_b_pct'] <= 15)

    def test_all_fixed_returns_empty_not_baseline_as_alternative(self):
        payload = {**SEARCH, 'fixed': list(BASE)}
        r = self.client.post('/ai-reformulation/optimize', json=payload)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()['candidates'], [])
        self.assertEqual(r.json()['process']['sampled_count'], 1)
        self.assertEqual(r.json()['status'], 'NO_FEASIBLE_ALTERNATIVE_FOUND')

    def test_equal_bounds_work_without_sampling_zero_width(self):
        payload = {**SEARCH, 'bounds': {'factor_a_pct': {'min': 4.0, 'max': 4.0}}}
        r = self.client.post('/ai-reformulation/optimize', json=payload)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertTrue(all(c['composition']['factor_a_pct'] == 4.0 for c in r.json()['candidates']))

    def test_unreachable_target_has_no_near_miss_fallback(self):
        r = self.client.post('/ai-reformulation/optimize', json={
            'product_id': PRODUCT, 'baseline': BASE, 'target_constraints': {'hydration_ratio_min': 100.0}})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()['candidates'], [])
        self.assertEqual(r.json()['process']['feasible_alternative_count'], 0)

    def test_predict_rejects_bad_types_ranges_missing_and_extra_fields(self):
        for value in ('4.0', True, -1, 10.1, None):
            with self.subTest(value=value):
                composition = {**BASE, 'factor_a_pct': value}
                self.assertEqual(self.client.post('/ai-reformulation/predict',
                    json={'product_id': PRODUCT, 'composition': composition}).status_code, 422)
        for composition in ({**BASE, 'water_pct': 90}, {'factor_c_pct': 3}):
            self.assertEqual(self.client.post('/ai-reformulation/predict',
                json={'product_id': PRODUCT, 'composition': composition}).status_code, 422)

    def test_nonfinite_inputs_are_rejected_without_serialization_failure(self):
        for value in ('NaN', 'Infinity', '-Infinity'):
            body = '{"product_id":"'+PRODUCT+'","composition":{"factor_a_pct":'+value+',"factor_b_pct":8,"factor_c_pct":2.2}}'
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
            {'fixed': ['factor_c_pct', 'factor_c_pct']}, {'fixed': ['unknown']},
            {'bounds': {'factor_a_pct': {'min': 0., 'max': 11.}}},
            {'bounds': {'factor_a_pct': {'min': 5., 'max': 10.}}},
            {'bounds': {'factor_a_pct': {'min': 2., 'max': 1.}}},
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
        for name, path, payload in [('load_sensory', '/ai-reformulation/predict', {'product_id': PRODUCT, 'composition': BASE}),
                                    ('load_rescue', '/reformulate', RESCUE)]:
            with patch('backend.main.'+name, side_effect=FileNotFoundError('SECRET/path')):
                r = self.client.post(path, json=payload)
                self.assertEqual(r.status_code, 503)
                self.assertNotIn('SECRET', r.text)
                self.assertNotIn('predicted_responses', r.json())

    def test_unexpected_error_is_sanitized(self):
        with patch.object(load_sensory(), 'predict', side_effect=RuntimeError('SECRET/path/traceback')):
            r = self.client.post('/ai-reformulation/predict', json={'product_id': PRODUCT, 'composition': BASE},
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
            r = self.client.post('/ai-reformulation/predict', json={'product_id': PRODUCT, 'composition': BASE},
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


    def test_product_catalog_and_product_identity_change_predictions(self):
        response = self.client.get('/ai-reformulation/products')
        self.assertEqual(response.status_code, 200, response.text)
        catalog = response.json()
        self.assertEqual(len(catalog['products']), 22)
        self.assertEqual(len({p['category_id'] for p in catalog['products']}), 11)
        self.assertEqual(catalog['data_origin'], 'SYNTHETIC_PROTOTYPE_DATA')
        first, second = catalog['products'][:2]
        composition = {f['key']: f['max'] * .5 for f in first['factors']}
        results = [self.client.post('/ai-reformulation/predict', json={
            'product_id': p['product_id'], 'composition': composition}) for p in (first, second)]
        self.assertTrue(all(r.status_code == 200 for r in results))
        self.assertNotEqual(results[0].json()['predicted_responses'], results[1].json()['predicted_responses'])
        for product in catalog['products']:
            r = self.client.post('/ai-reformulation/predict', json={
                'product_id': product['product_id'],
                'composition': {f['key']: f['baseline'] for f in product['factors']}})
            self.assertEqual(r.status_code, 200, r.text)

    def test_unknown_product_and_product_specific_bounds_are_rejected(self):
        for payload in ({'product_id': 'unknown', 'composition': BASE},
                        {'product_id': PRODUCT, 'composition': {**BASE, 'factor_a_pct': 10.1}}):
            self.assertEqual(self.client.post('/ai-reformulation/predict', json=payload).status_code, 422)
        r = self.client.post('/ai-reformulation/optimize', json={
            **SEARCH, 'bounds': {'factor_b_pct': {'min': 0., 'max': 15.1}}})
        self.assertEqual(r.status_code, 422)

if __name__ == '__main__':
    unittest.main()
