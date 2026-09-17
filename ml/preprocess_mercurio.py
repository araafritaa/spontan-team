"""Audit Mercurio only; no training, noise, scaling, imputation or splitting."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
STUDY = 'MERCURIO_2020_P2'
FEATURES = {'factor_1_value': 'phytantriol_pct', 'factor_2_value': 'soy_lecithin_pct', 'factor_3_value': 'cct_pct'}
TARGETS = ['hydration_ratio', 'stickiness_score_0_10', 'oiliness_score_0_10', 'consistency_index']
RANGES = {'phytantriol_pct': (0, 3), 'soy_lecithin_pct': (0, 3), 'cct_pct': (0, 5)}
NAMES = ['Phytantriol', 'Soy lecithin', 'Caprylic/capric triglycerides']
PROVENANCE = ['row_id', 'study_id', 'product_system', 'data_origin', 'is_empirical_ground_truth', 'generation_method', 'source_doi', 'source_url', 'validation_role', 'critical_note']
DISCLAIMER = 'Predicted / estimated and requires physical laboratory validation.'


def preprocess(raw):
    required = ['study_id', *FEATURES, *TARGETS, *PROVENANCE]
    required += [f'factor_{i}_{suffix}' for i in (1, 2, 3) for suffix in ('name', 'unit')]
    missing = sorted(set(required) - set(raw.columns))
    if missing:
        raise ValueError(f'Missing columns: {missing}')
    subset = raw.loc[raw.study_id.eq(STUDY)].copy()
    if subset.empty:
        raise ValueError('No Mercurio rows')
    subset = subset.rename(columns=FEATURES)
    columns = [*FEATURES.values(), *TARGETS]
    problems = [[] for _ in range(len(subset))]
    def flag(mask, reason):
        for i, bad in enumerate(mask):
            if bad:
                problems[i].append(reason)
    for i, name in enumerate(NAMES, 1):
        flag(~subset[f'factor_{i}_name'].eq(name), f'factor_{i}_identity')
        flag(~subset[f'factor_{i}_unit'].eq('%'), f'factor_{i}_unit')
    for col in columns:
        subset[col] = pd.to_numeric(subset[col], errors='coerce')
        flag(~np.isfinite(subset[col]), f'{col}_nonfinite')
    for col, (lo, hi) in RANGES.items():
        flag(~subset[col].between(lo, hi), f'{col}_domain')
    for col in TARGETS:
        flag(subset[col] < 0, f'{col}_negative')
    for col in TARGETS[1:3]:
        flag(subset[col] > 10, f'{col}_above_10')
    flag(subset.row_id.isna() | subset.row_id.astype(str).str.strip().eq(''), 'row_id_missing')
    flag(subset.row_id.duplicated(keep=False), 'row_id_duplicate')
    subset['exclusion_reason'] = [';'.join(p) for p in problems]
    excluded = subset.loc[subset.exclusion_reason.ne('')].copy()
    clean = subset.loc[subset.exclusion_reason.eq(''), PROVENANCE + columns].copy()
    # Only remove exact duplicate composition + response records. Keep distinct responses.
    duplicates = clean.duplicated(subset=columns, keep='first')
    if duplicates.any():
        extra = clean.loc[duplicates].assign(exclusion_reason='exact_numeric_duplicate')
        excluded = pd.concat([excluded, extra], ignore_index=True)
        clean = clean.loc[~duplicates].copy()
    if clean.empty:
        raise ValueError('No valid Mercurio rows remain')
    return clean.reset_index(drop=True), excluded, subset


def table(frame):
    header = '| Column | ' + ' | '.join(map(str, frame.columns)) + ' |'
    sep = '|---|' + '|'.join(['---'] * len(frame.columns)) + '|'
    rows = ['| ' + str(index) + ' | ' + ' | '.join(f'{v:.5f}' if isinstance(v, (float, np.floating)) else str(v) for v in row) + ' |' for index, row in frame.iterrows()]
    return '\n'.join([header, sep, *rows])


def run(input_path, output):
    workbook = pd.ExcelFile(input_path, engine='openpyxl')
    raw = pd.read_excel(workbook, sheet_name='Training_Master_500')
    clean, excluded, subset = preprocess(raw)
    columns = [*FEATURES.values(), *TARGETS]
    output.mkdir(parents=True, exist_ok=True)
    clean.to_csv(output / 'mercurio_clean.csv', index=False)
    excluded.to_csv(output / 'mercurio_excluded.csv', index=False)
    stats = clean[columns].describe().T
    corr = clean[columns].corr(method='pearson')
    stats.to_csv(output / 'descriptive_statistics.csv')
    corr.to_csv(output / 'pearson_correlations.csv')
    pd.DataFrame({'missing_count': raw.loc[raw.study_id.eq(STUDY)].isna().sum(), 'missing_pct': raw.loc[raw.study_id.eq(STUDY)].isna().mean()*100}).to_csv(output / 'missingness_all_columns.csv')
    groups = clean.groupby(list(FEATURES.values()), dropna=False).size()
    summary = {'study_id': STUDY, 'sheet': 'Training_Master_500', 'workbook_sha256': hashlib.sha256(input_path.read_bytes()).hexdigest(), 'workbook_rows': len(raw), 'selected_rows': len(subset), 'clean_rows': len(clean), 'excluded_rows': len(excluded), 'unique_compositions': len(groups), 'repeated_composition_groups': int((groups > 1).sum()), 'feature_order': list(FEATURES.values()), 'target_order': TARGETS, 'feature_ranges_pct': RANGES, 'data_origin_counts': clean.data_origin.value_counts().to_dict(), 'empirical_ground_truth_counts': clean.is_empirical_ground_truth.astype(str).value_counts().to_dict(), 'validation_role_counts': clean.validation_role.value_counts().to_dict(), 'target_units': {'hydration_ratio': 'ratio', 'stickiness_score_0_10': 'score 0-10', 'oiliness_score_0_10': 'score 0-10', 'consistency_index': 'source-defined consistency index; confirm physical unit against original paper'}, 'transformations': ['study filter', 'numeric conversion', 'finite/domain/identity/unit validation', 'exact numeric deduplication', 'provenance retained'], 'noise_added': False, 'training_performed': False, 'split_created': False, 'versions': {'pandas': pd.__version__, 'numpy': np.__version__}, 'disclaimer': DISCLAIMER}
    (output / 'preprocessing_metadata.json').write_text(json.dumps(summary, indent=2, allow_nan=False), encoding='utf-8')
    origins = ', '.join(f'{k}: {v}' for k,v in summary['data_origin_counts'].items())
    report = f'''# AI Reformulation — Mercurio preprocessing & EDA

## Scope and actual result

Source workbook: `{input_path.name}`, sheet `Training_Master_500`.
Filter: `study_id == {STUDY}`. This is composition-to-response preparation only.

| Audit | Count |
|---|---:|
| Workbook rows | {len(raw)} |
| Other studies ignored | {len(raw)-len(subset)} |
| Mercurio selected | {len(subset)} |
| Invalid/exact duplicates excluded | {len(excluded)} |
| Clean rows | {len(clean)} |
| Unique compositions | {len(groups)} |
| Repeated composition groups | {int((groups>1).sum())} |

## Provenance and scientific boundary

Data origin: {origins}.
Empirical-ground-truth flags: {summary['empirical_ground_truth_counts']}.
Validation roles: {summary['validation_role_counts']}.
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

The seven selected model columns have {int(clean[columns].isna().sum().sum())} missing values after validation.
Full 44-column missingness is exported separately. Unrelated endpoints/process fields
are not imputed or used as predictors; missingness there is not a reason to remove otherwise valid rows.

## Descriptive statistics

{table(stats)}

The min/max summarize sampled points, not necessarily exact design boundaries.
Different output scales motivate reporting MAE and R² separately per target later.

## Pearson correlation (exploratory only)

{table(corr)}

Correlation describes linear association in this generated sample, not causality,
feature importance, or laboratory evidence. Weak correlation may hide nonlinear/interacting effects.
These values reflect a shared equation-generation process; do not treat them as independent experiments.

## Findings relevant to the optimizer

- Lecithin vs hydration Pearson r = {corr.loc['soy_lecithin_pct','hydration_ratio']:.5f}.
  Perfect linear association in this file is consistent with deterministic equation-derived targets;
  it is not independent physical evidence of ingredient effects.
- Lecithin vs stickiness r = {corr.loc['soy_lecithin_pct','stickiness_score_0_10']:.5f},
  vs oiliness r = {corr.loc['soy_lecithin_pct','oiliness_score_0_10']:.5f}:
  optimizing hydration alone can worsen other predicted sensory responses.
- Observed hydration maximum = {clean.hydration_ratio.max():.6f}.
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

{DISCLAIMER}
'''
    (output / 'MERCURIO_PREPROCESSING_EDA.md').write_text(report, encoding='utf-8')
    print(json.dumps({k: summary[k] for k in ('workbook_rows','selected_rows','clean_rows','excluded_rows','unique_compositions')}, indent=2))
    print(f'Report: {output / "MERCURIO_PREPROCESSING_EDA.md"}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=Path, default=ROOT / 'Phase2_500_Prototype_Training_Dataset.xlsx')
    parser.add_argument('--output', type=Path, default=ROOT / 'data/processed/mercurio')
    args = parser.parse_args()
    run(args.input.resolve(), args.output.resolve())
