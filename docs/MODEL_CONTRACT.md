# Cloudeka Model Handover Contract

Status: local saved-model handover implemented (2026-09-17). Cloudeka training evidence and deployment verification remain TBD.

## Current two-engine handover

The API never trains during a request and never imports the old training-at-import
`spontan_engine/forward_model.py`. Models are independent and CPU-served.

### Formula Rescue

- Loader: `backend/predictor.py` delegates to `Hackathon/rescue/engine.py`.
- Artifact: `Hackathon/ml/artifacts/stability_model.json` (native XGBoost JSON).
- Metadata/ordered inputs: `Hackathon/ml/artifacts/model_metadata.json`, exactly
  18 non-water ingredient concentrations. Do not reorder or include `water_pct`.
- Catalog: `Hackathon/data/processed/formulations_clean.csv`, 812 rows,
  294 stable. Catalog construction and input transforms stay in the original engine.
- Wrapper: `XGBClassifier`, requires scikit-learn at runtime.
- Output: class-1 phase-stability estimate, not a guaranteed laboratory outcome.
  Ranking uses 50% stability, 35% similarity and 15% minimal changes.
- Actual initial-load inference must return finite `(1, 2)` probabilities.
- API versions are SHA256 of model and catalog files separately. No retraining
  or catalog update was performed by this backend stage.
- Fixture: formula 7, Plantacare 818 unavailable, Top 3 IDs 288, 292, 190.
- Evaluation/history: `FORMULA_RESCUE_PREPROCESSING_TRAINING_REPORT.md`.

### AI Reformulation — current synthetic product prototype (2026-09-18)

- Artifact: `ml/artifacts/synthetic_product_polynomial_ridge_v1/`.
- Loader: `ml/predict_product.py`; backend cache verifies an actual fixture prediction.
- 22 product profiles in 11 categories. Public product names identify the profile;
  factor identities, ranges, baselines and response equations are invented prototype data,
  not Paragon manufacturing formulas or measured performance.
- API inputs: required `product_id` plus `factor_a_pct`, `factor_b_pct`,
  `factor_c_pct`, finite percentages inside that product's catalog limits.
- Backend derives category and normalizes percentages by each profile factor maximum.
- Ordered model columns: `product_id`, `category_id`, `factor_a_ratio`,
  `factor_b_ratio`, `factor_c_ratio`.
- Pipeline: degree-2 numeric polynomial without bias -> StandardScaler;
  product/category OneHotEncoder; multi-output Ridge alpha=0.05.
- Ordered targets: hydration_ratio, stickiness_score_0_10, oiliness_score_0_10,
  consistency_index. Units: synthetic ratio, two illustrative 0–10 scores,
  arbitrary synthetic consistency index (not measured viscosity).
- 2,112 generated rows (96/product), seed 20260918. Stratified 80/20 split:
  1,689 development / 423 holdout before fitting preprocessing.
  Each product is seen during training; no unseen-product or physical-validation claim.
- Evaluation model fits development only. Serving artifact fits all rows after evaluation.
  Per-target MAE/RMSE/R² and a mean baseline are in evaluation.json.
- Catalog and model SHA256 are validated before trusted joblib loading.
  Unknown product, missing/nonfinite concentrations or out-of-profile values return 422.
- Optimization: Latin hypercube search, up to 10,000 compositions within the selected
  profile, numerical target filtering, normalized minimal-change ranking and diversity.
  Product-aware inference, not frontend canned candidate responses.
- Provenance: SYNTHETIC_PROTOTYPE_DATA. No lab accuracy, safety, efficacy or stability claim.
- Training ran on local CPU, NOT Cloudeka; event training evidence is still missing.
- Historical artifact `ml/artifacts/mercurio_polynomial_ridge_v1/` and loader
  `ml/predict_mercurio.py` are preserved, along with their tests and reports.
- Detailed boundary and verification: `docs/PRODUCT_MODEL_INTEGRATION.md`.

Trusted joblib only: SHA256 detects a mismatch against the metadata, but does
not authenticate an artifact if both metadata and model are replaced. Never
accept artifact paths/files from API users.

Monthly improvement remains a documented future workflow, not a running service.
Lab storage, retraining jobs, release comparison and rollback are not implemented.
See `AI_REFORMULATION_PROCESS_AND_ENGINE.md` for the planned workflow.

The draft template below is preserved for future team/organizer decisions.

## Task and data

- Task: classification / regression / other (choose and define): TBD
- Target/labels and positive class meaning: TBD
- Data source/license/privacy: TBD
- Train/validation/test split, seed, grouping/time rules: TBD
- Metric(s), baseline comparison, leakage checks: TBD
- Cloudeka evidence required by organizer: TBD

## Input contract

| Ordered feature | Type | Unit/range | Missing-value policy |
|---|---|---|---|
| TBD | TBD | TBD | TBD |

For image/text input, replace feature table with format, size/length, preprocessing, and tokenizer/encoder requirements. Preserve feature order, units, categories, and preprocessing learned from training only.

## Output contract

- Label/value/score meaning and shape: TBD
- Threshold and how selected: TBD
- Score calibration status: TBD
- Invalid/out-of-distribution input handling: TBD
- Disclaimer and known limits: TBD

## Deliverables

| Item | Actual path/name |
|---|---|
| Model artifact | TBD |
| Preprocessing pipeline / explicit transformations | TBD |
| metadata: features, labels, versions, seed | TBD |
| metrics: unseen-data results, dataset split | TBD |
| one input fixture + expected output/tolerance | TBD |
| minimal loading/prediction instructions | TBD |

Model version/checksum: TBD. Python/library versions: TBD. CPU inference time/memory: TBD.

Training dependencies and inference dependencies may differ. Some wrappers require extra runtime packages (e.g. XGBClassifier needs scikit-learn); verify rather than infer from import statements alone.

## Transfer from Cloudeka

1. Save permitted artifacts and evaluation; remove credentials/private raw data and sensitive notebook outputs.
2. Commit/push permitted small artifacts, or use agreed access-controlled transfer for larger ones: TBD.
3. Receiver loads artifacts in clean runtime, runs fixture, and confirms label/score tolerance.

Do not load untrusted pickle/joblib artifacts; use only team-produced trusted files. JSON alone does not prove integrity or model quality. Backend never retrains during a request.
