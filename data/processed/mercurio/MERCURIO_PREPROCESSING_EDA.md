# AI Reformulation — Mercurio preprocessing & EDA

## Scope and actual result

Source workbook: `Phase2_500_Prototype_Training_Dataset.xlsx`, sheet `Training_Master_500`.
Filter: `study_id == MERCURIO_2020_P2`. This is composition-to-response preparation only.

| Audit | Count |
|---|---:|
| Workbook rows | 500 |
| Other studies ignored | 347 |
| Mercurio selected | 153 |
| Invalid/exact duplicates excluded | 0 |
| Clean rows | 153 |
| Unique compositions | 153 |
| Repeated composition groups | 0 |

## Provenance and scientific boundary

Data origin: MODEL_GENERATED_PUBLISHED_EQUATION: 153.
Empirical-ground-truth flags: {'False': 153}.
Validation roles: {'NOT_INDEPENDENT_VALIDATION': 153}.
These records describe interpolation from published response equations, not new lab measurements.
Workbook labels/provenance are retained; original paper equations and units are not independently verified here.
The three inputs describe study factors, not a complete commercial formula or proven causal effects.
Do not pool other study/product rows merely to increase sample size.

## Ordered input/output contract

| Field | Role | Unit / design range |
|---|---|---|
| phytantriol_pct | Input 1 | %; 0–3 |
| soy_lecithin_pct | Input 2 | %; 0–3 |
| cct_pct | Input 3 | %; 0–5 |
| hydration_ratio | Output 1 | Ratio |
| stickiness_score_0_10 | Output 2 | Score 0–10 |
| oiliness_score_0_10 | Output 3 | Score 0–10 |
| consistency_index | Output 4 | Source-defined index; physical unit must be confirmed |

Provenance columns are retained in CSV, but must not be input features.
Column names differ from old forward_model.py aliases; future training must use this explicit ordered contract.

## Preprocessing steps

1. Validate required columns; select Mercurio only. Fail if study is absent.
2. Verify factor identities and percent units; rename numeric features.
3. Convert seven model columns to numeric; reject missing/nonfinite values.
4. Check published input ranges, nonnegative outputs, sensory scores at most 10.
5. Reject missing/duplicate row IDs; remove exact composition+response duplicates.
   Distinct responses at identical compositions stay available and must be grouped for splitting.
6. Preserve provenance, export clean/rejected rows, statistics and metadata.

No imputation, scaling, clipping, added noise, feature selection, training or train/test split.
Outliers are not discarded merely because they are unusual; only explicit validity rules apply.

## Missing values

The seven selected model columns have 0 missing values after validation.
Full 44-column missingness is exported separately. Unrelated endpoints/process fields
are not imputed or used as predictors; missingness there is not a reason to remove otherwise valid rows.

## Descriptive statistics

| Column | count | mean | std | min | 25% | 50% | 75% | max |
|---|---|---|---|---|---|---|---|---|
| phytantriol_pct | 153.00000 | 1.50005 | 0.86930 | 0.01281 | 0.76334 | 1.50766 | 2.24173 | 2.98357 |
| soy_lecithin_pct | 153.00000 | 1.50000 | 0.86874 | 0.01400 | 0.75779 | 1.50849 | 2.24158 | 2.98483 |
| cct_pct | 153.00000 | 2.49944 | 1.44892 | 0.00596 | 1.26853 | 2.48897 | 3.73034 | 4.98491 |
| hydration_ratio | 153.00000 | 1.50000 | 0.05417 | 1.40733 | 1.45372 | 1.50053 | 1.54624 | 1.59259 |
| stickiness_score_0_10 | 153.00000 | 3.06833 | 0.62464 | 1.55192 | 2.73234 | 3.07795 | 3.47245 | 4.75670 |
| oiliness_score_0_10 | 153.00000 | 2.54480 | 0.58153 | 0.87124 | 2.22376 | 2.68139 | 2.94957 | 3.49396 |
| consistency_index | 153.00000 | 27320.04278 | 1412.87855 | 24133.16889 | 26194.81068 | 27295.41938 | 28292.39399 | 30451.60811 |

The min/max summarize sampled points, not necessarily exact design boundaries.
Different output scales motivate reporting MAE and R² separately per target later.

## Pearson correlation (exploratory only)

| Column | phytantriol_pct | soy_lecithin_pct | cct_pct | hydration_ratio | stickiness_score_0_10 | oiliness_score_0_10 | consistency_index |
|---|---|---|---|---|---|---|---|
| phytantriol_pct | 1.00000 | -0.12133 | -0.02162 | -0.12133 | -0.09402 | -0.06701 | 0.40719 |
| soy_lecithin_pct | -0.12133 | 1.00000 | 0.13153 | 1.00000 | 0.74026 | 0.74723 | 0.85719 |
| cct_pct | -0.02162 | 0.13153 | 1.00000 | 0.13153 | -0.24944 | 0.07985 | 0.10981 |
| hydration_ratio | -0.12133 | 1.00000 | 0.13153 | 1.00000 | 0.74026 | 0.74723 | 0.85719 |
| stickiness_score_0_10 | -0.09402 | 0.74026 | -0.24944 | 0.74026 | 1.00000 | 0.83329 | 0.63236 |
| oiliness_score_0_10 | -0.06701 | 0.74723 | 0.07985 | 0.74723 | 0.83329 | 1.00000 | 0.65279 |
| consistency_index | 0.40719 | 0.85719 | 0.10981 | 0.85719 | 0.63236 | 0.65279 | 1.00000 |

Correlation describes linear association in this generated sample, not causality,
feature importance, or laboratory evidence. Weak correlation may hide nonlinear/interacting effects.
These values reflect a shared equation-generation process; do not treat them as independent experiments.

## Findings relevant to the optimizer

- Lecithin vs hydration Pearson r = 1.00000.
  Perfect linear association in this file is consistent with deterministic equation-derived targets;
  it is not independent physical evidence of ingredient effects.
- Lecithin vs stickiness r = 0.74026,
  vs oiliness r = 0.74723:
  optimizing hydration alone can worsen other predicted sensory responses.
- Observed hydration maximum = 1.592594.
  The old optimizer example hydration_min=1.60 exceeds this clean sample maximum.
  A standard squared-error Random Forest averages training target values and cannot
  exceed its training target maximum. Therefore this target is infeasible for a model
  trained solely on these unchanged clean targets, though this is not a proof of physical impossibility.
  Adding simulated noise to make such targets reachable would not demonstrate real improvement.
- No process data are available in this Mercurio block: the model cannot learn mixing effects.

## Next-stage evaluation safeguards

- Split before fitting any learned transformation or tuning; group identical compositions together.
- Report MAE and R² per target versus a mean baseline, and compare direct published equations if available.
- A held-out generated sample tests equation approximation, not real-world lab generalization.
- Keep physical measurements separate and reserve genuinely independent lab evidence for validation.
- No accuracy/model metrics exist from this preprocessing stage.

## Reproduce and verify

Run from project root (local or Cloudeka with workbook copied alongside project):

```powershell
py ml/preprocess_mercurio.py
py -m unittest discover -s ml/tests -v
```

On Linux/Cloudeka use `python` in place of `py`.
Dependencies: pandas, numpy, openpyxl. Existing forward_model.py is not imported,
so training code cannot execute as a side effect.
Outputs: `data/processed/mercurio/` with clean CSV, exclusions, statistics,
correlations, full-column missingness, metadata and this generated report.
Unit tests cover study isolation, schema failure, missing/nonfinite data,
identity/unit errors, range rejection, exact duplicates and repeated compositions.

Predicted / estimated and requires physical laboratory validation.
