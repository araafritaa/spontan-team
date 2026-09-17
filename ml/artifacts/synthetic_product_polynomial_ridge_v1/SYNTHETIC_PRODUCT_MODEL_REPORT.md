# Synthetic product-aware AI Reformulation model

This prototype uses public product names only as identifiers. Ingredient-factor profiles, baselines, training rows, and responses are synthetic and are not manufacturer formulas or laboratory measurements.

- Dataset: 2112 generated rows, 22 products, 11 categories, 96 rows/product.
- Split: 1689 development / 423 holdout, seed 20260918, stratified by product before fitting preprocessing.
- Pipeline: normalized factor ratios; degree-2 terms + scaling; product/category one-hot; multi-output Ridge.
- Product and category are actual model inputs, so identical normalized compositions can produce different product-specific predictions.

## Holdout metrics (synthetic equation interpolation only)

| Target | MAE | RMSE | R² | Dummy MAE |
|---|---:|---:|---:|---:|
| hydration_ratio | 0.00453392 | 0.00566621 | 0.999056 | 0.153895 |
| stickiness_score_0_10 | 0.0202238 | 0.0256502 | 0.998875 | 0.643815 |
| oiliness_score_0_10 | 0.0206651 | 0.02566 | 0.998928 | 0.668138 |
| consistency_index | 53.9735 | 67.7187 | 0.999903 | 5705.85 |

R² is not classification accuracy. These metrics only show how well the model reproduces its synthetic generator on held-out synthetic rows.

## Serving boundary

The API rejects unknown products, missing/non-finite factors, and percentages outside the selected profile. Optimization searches within the selected profile ranges. No request retrains the model.

Predicted / estimated and requires physical laboratory validation.
