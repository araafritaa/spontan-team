"""Generate disclosed synthetic prototype data, evaluate, and export one product-aware model."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import platform
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, PolynomialFeatures, StandardScaler

from product_profiles import DATA_ORIGIN, DISCLAIMER, FEATURES, PRODUCTS, TARGETS

ROOT = Path(__file__).resolve().parents[1]
VERSION = "synthetic_product_polynomial_ridge_v1"
MODEL_COLUMNS = ["product_id", "category_id", "factor_a_ratio", "factor_b_ratio", "factor_c_ratio"]
SEED = 20260918
ROWS_PER_PRODUCT = 96


def response_equations(x, category_index, product_index):
    """Illustrative equations only; not manufacturer knowledge or laboratory truth."""
    a, b, c = x[:, 0], x[:, 1], x[:, 2]
    category_shift = (category_index - 5) / 50
    product_shift = ((product_index % 2) * 2 - 1) * 0.025
    hydration = .88 + .18*a + .52*b + .20*c + .10*b*c - .04*a*c + category_shift + product_shift
    stickiness = 1.45 + .55*a + 2.05*b + 1.15*c + .55*b*c + .08*(category_index % 4) + product_shift*2
    oiliness = 1.15 + .38*a + 2.45*b + .80*c + .45*a*b + .07*(category_index % 5) - product_shift
    consistency = 6500 + 4200*a + 2600*b + 20500*c + 3600*a*c + category_index*720 + product_index*55
    return np.column_stack([hydration, stickiness, oiliness, consistency])


def dataset():
    rng = np.random.default_rng(SEED)
    rows = []
    categories = {name: index for index, name in enumerate(dict.fromkeys(p["category_id"] for p in PRODUCTS))}
    for product_index, product in enumerate(PRODUCTS):
        # Independent uniform design including the exact product baseline as the first row.
        ratios = rng.uniform(.04, .96, size=(ROWS_PER_PRODUCT, 3))
        ratios[0] = [f["baseline"] / f["max"] for f in product["factors"]]
        y = response_equations(ratios, categories[product["category_id"]], product_index)
        noise = rng.normal(0, [0.006, 0.025, 0.025, 65], size=y.shape)
        noise[0] = 0  # deterministic fixture at the catalog baseline
        y += noise
        for row_index, (xrow, yrow) in enumerate(zip(ratios, y)):
            rows.append({"row_id": f"{product['product_id']}-{row_index:03d}",
                         "product_id": product["product_id"], "category_id": product["category_id"],
                         **dict(zip(MODEL_COLUMNS[2:], xrow)), **dict(zip(TARGETS, yrow)),
                         "data_origin": DATA_ORIGIN, "is_empirical_ground_truth": False})
    return pd.DataFrame(rows)


def pipeline():
    numeric = MODEL_COLUMNS[2:]
    preprocess = ColumnTransformer([
        ("numeric_polynomial", Pipeline([
            ("polynomial", PolynomialFeatures(degree=2, include_bias=False)),
            ("scale", StandardScaler()),
        ]), numeric),
        ("categorical", OneHotEncoder(handle_unknown="error", sparse_output=False), MODEL_COLUMNS[:2]),
    ], sparse_threshold=0)
    return Pipeline([("preprocess", preprocess), ("regressor", Ridge(alpha=.05))])


def score(y, predicted):
    return {target: {"mae": float(mean_absolute_error(y[:, i], predicted[:, i])),
                     "rmse": float(np.sqrt(mean_squared_error(y[:, i], predicted[:, i]))),
                     "r2": float(r2_score(y[:, i], predicted[:, i]))}
            for i, target in enumerate(TARGETS)}


def save_json(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False, allow_nan=False), encoding="utf-8")


def run(output):
    if output.exists() and any(output.iterdir()):
        raise ValueError("Output already populated; use an empty directory.")
    frame = dataset()
    train_index, test_index = train_test_split(np.arange(len(frame)), test_size=.2, random_state=SEED,
                                                stratify=frame["product_id"])
    X, y = frame[MODEL_COLUMNS], frame[TARGETS].to_numpy()
    evaluation_model = pipeline().fit(X.iloc[train_index], y[train_index])
    prediction = evaluation_model.predict(X.iloc[test_index])
    dummy = DummyRegressor().fit(X.iloc[train_index], y[train_index])
    evaluation = {
        "split": "80/20 stratified by product_id before fitting preprocessing",
        "seed": SEED, "development_rows": len(train_index), "holdout_rows": len(test_index),
        "holdout": score(y[test_index], prediction),
        "dummy_holdout": score(y[test_index], dummy.predict(X.iloc[test_index])),
        "interpretation": "Interpolation of disclosed synthetic equations; not laboratory or commercial-product accuracy.",
    }
    final_model = pipeline().fit(X, y)
    output.mkdir(parents=True, exist_ok=True)
    model_path = output / "sensory_model.joblib"
    joblib.dump(final_model, model_path, compress=3)
    catalog = {"catalog_version": VERSION, "data_origin": DATA_ORIGIN,
               "notice": "Product names are public identifiers. Every factor profile and baseline is synthetic prototype data, not a Paragon formula.",
               "products": PRODUCTS, "disclaimer": DISCLAIMER}
    save_json(output / "product_catalog.json", catalog)
    catalog_sha = hashlib.sha256((output / "product_catalog.json").read_bytes()).hexdigest()
    example_product = PRODUCTS[0]
    ratios = {f"factor_{letter}_ratio": factor["baseline"] / factor["max"]
              for letter, factor in zip("abc", example_product["factors"])}
    example_frame = pd.DataFrame([{ "product_id": example_product["product_id"],
        "category_id": example_product["category_id"], **ratios}], columns=MODEL_COLUMNS)
    expected = final_model.predict(example_frame)[0]
    metadata = {
        "model_version": VERSION, "model_type": "product/category one-hot + degree-2 numeric polynomial + StandardScaler + multi-output Ridge",
        "created_at_utc": datetime.now(timezone.utc).isoformat(), "training_environment": "local_cpu",
        "cloudeka_training_evidence": "Not collected; this artifact was trained locally.",
        "model_input_order": MODEL_COLUMNS, "api_feature_order": FEATURES, "target_order": TARGETS,
        "data_origin": DATA_ORIGIN, "dataset_rows": len(frame), "products": len(PRODUCTS),
        "categories": len(set(frame.category_id)), "rows_per_product": ROWS_PER_PRODUCT,
        "seed": SEED, "ridge_alpha": .05, "degree": 2,
        "model_sha256": hashlib.sha256(model_path.read_bytes()).hexdigest(), "catalog_sha256": catalog_sha,
        "versions": {"python": platform.python_version(), "scikit_learn": sklearn.__version__,
                     "numpy": np.__version__, "pandas": pd.__version__, "joblib": joblib.__version__},
        "input_policy": "Known product_id plus exactly three finite percentages within its synthetic profile ranges.",
        "disclaimer": DISCLAIMER,
    }
    fixture_input = {"product_id": example_product["product_id"],
                     "composition": {f["key"]: f["baseline"] for f in example_product["factors"]}}
    save_json(output / "model_metadata.json", metadata)
    save_json(output / "evaluation.json", evaluation)
    save_json(output / "prediction_example.json", {"model_version": VERSION, "input": fixture_input,
        "expected_output": dict(zip(TARGETS, expected.tolist())), "rtol": 1e-9, "atol": 1e-7,
        "physical_measurement": False, "disclaimer": DISCLAIMER})
    frame.to_csv(output / "synthetic_training_data.csv", index=False)
    holdout = frame.iloc[test_index][["row_id", *MODEL_COLUMNS, *TARGETS]].copy()
    for i, target in enumerate(TARGETS): holdout[target + "_predicted"] = prediction[:, i]
    holdout.to_csv(output / "holdout_predictions.csv", index=False)
    save_json(output / "split_manifest.json", {"development_row_ids": frame.iloc[train_index].row_id.tolist(),
                                                "holdout_row_ids": frame.iloc[test_index].row_id.tolist()})
    report = ["# Synthetic product-aware AI Reformulation model", "",
        "This prototype uses public product names only as identifiers. Ingredient-factor profiles, baselines, training rows, and responses are synthetic and are not manufacturer formulas or laboratory measurements.", "",
        f"- Dataset: {len(frame)} generated rows, {len(PRODUCTS)} products, {metadata['categories']} categories, {ROWS_PER_PRODUCT} rows/product.",
        f"- Split: {len(train_index)} development / {len(test_index)} holdout, seed {SEED}, stratified by product before fitting preprocessing.",
        "- Pipeline: normalized factor ratios; degree-2 terms + scaling; product/category one-hot; multi-output Ridge.",
        "- Product and category are actual model inputs, so identical normalized compositions can produce different product-specific predictions.", "",
        "## Holdout metrics (synthetic equation interpolation only)", "",
        "| Target | MAE | RMSE | R² | Dummy MAE |", "|---|---:|---:|---:|---:|",
    ]
    for target in TARGETS:
        metric, base = evaluation["holdout"][target], evaluation["dummy_holdout"][target]
        report.append(f"| {target} | {metric['mae']:.6g} | {metric['rmse']:.6g} | {metric['r2']:.6f} | {base['mae']:.6g} |")
    report += ["", "R² is not classification accuracy. These metrics only show how well the model reproduces its synthetic generator on held-out synthetic rows.", "",
               "## Serving boundary", "", "The API rejects unknown products, missing/non-finite factors, and percentages outside the selected profile. Optimization searches within the selected profile ranges. No request retrains the model.", "", DISCLAIMER]
    (output / "SYNTHETIC_PRODUCT_MODEL_REPORT.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    print(json.dumps({"model_version": VERSION, "rows": len(frame), "products": len(PRODUCTS),
                      "holdout": evaluation["holdout"]}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=ROOT / "ml/artifacts" / VERSION)
    args = parser.parse_args()
    run(args.output.resolve())
