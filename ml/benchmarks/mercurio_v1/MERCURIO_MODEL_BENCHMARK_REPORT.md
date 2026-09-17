# AI Reformulation — Mercurio model benchmark

Local CPU benchmark: 153 generated rows; 122 development / 31 holdout.
Same composition-group holdout and five development folds for all four models.
No added noise. Scalers/polynomial pipelines are fitted only within each training fold.

## Fixed model configurations

- Dummy: training mean per target.
- Linear Ridge: StandardScaler + alpha=1.
- Polynomial Ridge: degree 2, includes pairwise interactions/squares, StandardScaler + alpha=0.000001.
- Random Forest: 500 trees, min_samples_leaf=3, seed=42, CPU n_jobs=2.
- No hyperparameter search; weak polynomial penalty is a declared noise-free approximation baseline, not proof of robustness to measured noise.

## Development cross-validation

| Model | Mean R² across targets/folds |
|---|---:|
| Polynomial2_Ridge | 1.00000000 |
| RandomForest | 0.89753951 |
| Ridge_linear | 0.76493538 |
| Dummy_mean | -0.06033951 |

Candidate selected before holdout inspection: **Polynomial2_Ridge**.
Mean R² is only a declared comparison criterion, not a physical utility or guarantee.

## Holdout — per target

| Model | Target | MAE | R² |
|---|---|---:|---:|
| Dummy_mean | hydration_ratio | 0.04144599 | -0.12586611 |
| Dummy_mean | stickiness_score_0_10 | 0.44456187 | -0.11095999 |
| Dummy_mean | oiliness_score_0_10 | 0.42699250 | -0.14707410 |
| Dummy_mean | consistency_index | 1164.28357957 | -0.23043113 |
| Ridge_linear | hydration_ratio | 0.00036564 | 0.99990957 |
| Ridge_linear | stickiness_score_0_10 | 0.19917338 | 0.76476731 |
| Ridge_linear | oiliness_score_0_10 | 0.29706733 | 0.44439351 |
| Ridge_linear | consistency_index | 11.30121404 | 0.99987641 |
| Polynomial2_Ridge | hydration_ratio | 0.00000000 | 1.00000000 |
| Polynomial2_Ridge | stickiness_score_0_10 | 0.00000006 | 1.00000000 |
| Polynomial2_Ridge | oiliness_score_0_10 | 0.00000009 | 1.00000000 |
| Polynomial2_Ridge | consistency_index | 0.00004790 | 1.00000000 |
| RandomForest | hydration_ratio | 0.00406934 | 0.98613325 |
| RandomForest | stickiness_score_0_10 | 0.20992950 | 0.74840859 |
| RandomForest | oiliness_score_0_10 | 0.12347658 | 0.87479022 |
| RandomForest | consistency_index | 221.34138216 | 0.95075380 |

## Interpretation and limitations

MAE is in each target’s original unit; consistency-index errors cannot be compared directly to hydration-ratio errors.
R² is not percentage accuracy. Near-perfect fit on generated equation targets demonstrates approximation, not successful physical formulation.
Hydration is perfectly linearly associated with lecithin in this dataset. Polynomial terms can approximate equation-derived interactions in other responses.
Random Forest also shares splits across differently scaled targets; its default squared-error objective can be dominated by consistency_index. Its result is not proof that all RF variants are inferior.
Polynomial prediction is not bounded: enforce supported input domain and physical output checks before optimizer integration.
Other ingredient identities, process settings, stability, safety, cost and sustainability are outside this model contract.
All rows share published-equation provenance; generated holdout/CV is NOT independent lab validation.
Direct published equations were not executed or verified; compare them before deciding whether an ML surrogate is necessary.
No serialized model or backend replacement is created in this benchmark stage.
For hackathon compliance, repeat the reproducible pipeline in Cloudeka and keep required evidence.

## Reproduce

From project root: `py ml/benchmark_mercurio.py` (Linux: `python`).
Outputs: metrics.csv, holdout_predictions.csv, split_manifest.json, benchmark_metadata.json and this report.
Dependencies: numpy, pandas, scikit-learn (tested version recorded in metadata).

Predicted / estimated and requires physical laboratory validation.
