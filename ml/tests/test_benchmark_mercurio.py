import sys
from pathlib import Path
import unittest
import numpy as np
import pandas as pd
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from benchmark_mercurio import candidates, split_indices, score_rows

class BenchmarkTests(unittest.TestCase):
    def test_group_split_is_disjoint_and_reproducible(self):
        frame=pd.DataFrame({'phytantriol_pct':np.repeat(np.arange(20)/10,2),'soy_lecithin_pct':1,'cct_pct':2})
        a,b,g=split_indices(frame);c,d,_=split_indices(frame)
        self.assertFalse(set(g[a]) & set(g[b]))
        np.testing.assert_array_equal(a,c);np.testing.assert_array_equal(b,d)

    def test_four_models_produce_four_finite_outputs(self):
        rng=np.random.default_rng(42);X=rng.uniform(size=(30,3));Y=np.column_stack([X[:,0],X[:,1],X[:,2],X.sum(axis=1)])
        self.assertEqual(len(candidates()),4)
        for name,model in candidates().items():
            with self.subTest(name=name):
                pred=model.fit(X,Y).predict(X[:2]);self.assertEqual(pred.shape,(2,4));self.assertTrue(np.isfinite(pred).all())

    def test_metrics_match_targets(self):
        y=np.arange(20).reshape(5,4)
        rows=score_rows('test','holdout',y,y)
        self.assertEqual(len(rows),4)
        self.assertTrue(all(r['mae']==0 and r['r2']==1 for r in rows))

if __name__=='__main__':unittest.main()
