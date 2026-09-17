import importlib.util
from pathlib import Path
import unittest
import numpy as np
import pandas as pd

spec = importlib.util.spec_from_file_location('mercurio_preprocessing', Path(__file__).resolve().parents[1] / 'preprocess_mercurio.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class PreprocessingTests(unittest.TestCase):
    def fixture(self):
        row = {col: 'fixture' for col in module.PROVENANCE}
        row.update(study_id=module.STUDY, row_id='one', is_empirical_ground_truth=False)
        for i, name in enumerate(module.NAMES, 1):
            row.update({f'factor_{i}_name': name, f'factor_{i}_unit': '%', f'factor_{i}_value': 1.5})
        row.update(dict(zip(module.TARGETS, [1.6, 3, 2, 28000])))
        return pd.DataFrame([row])

    def test_valid_and_other_study_ignored(self):
        raw = self.fixture()
        raw = pd.concat([raw, raw.assign(study_id='OTHER')])
        clean, rejected, selected = module.preprocess(raw)
        self.assertEqual((len(clean),len(rejected),len(selected)),(1,0,1))
        self.assertEqual(clean.phytantriol_pct.iloc[0],1.5)

    def test_missing_schema(self):
        with self.assertRaises(ValueError): module.preprocess(self.fixture().drop(columns='hydration_ratio'))

    def test_no_study(self):
        with self.assertRaises(ValueError): module.preprocess(self.fixture().assign(study_id='OTHER'))

    def test_invalid_values_rejected(self):
        for col, value in [('factor_1_value',np.nan),('factor_1_value',np.inf),('factor_1_value',4),('factor_1_name','Wrong'),('factor_1_unit','g'),('stickiness_score_0_10',11),('hydration_ratio',-1)]:
            with self.subTest(col=col,value=value):
                raw = pd.concat([self.fixture(), self.fixture().assign(row_id='bad', **{col:value})],ignore_index=True)
                clean, rejected, _ = module.preprocess(raw)
                self.assertEqual((len(clean),len(rejected)),(1,1))

    def test_exact_numeric_duplicate_removed(self):
        raw=pd.concat([self.fixture(),self.fixture().assign(row_id='two')])
        clean,rejected,_=module.preprocess(raw)
        self.assertEqual((len(clean),len(rejected)),(1,1))

    def test_repeated_composition_distinct_response_retained(self):
        raw=pd.concat([self.fixture(),self.fixture().assign(row_id='two',hydration_ratio=1.7)])
        clean,rejected,_=module.preprocess(raw)
        self.assertEqual((len(clean),len(rejected)),(2,0))

if __name__ == '__main__': unittest.main()
