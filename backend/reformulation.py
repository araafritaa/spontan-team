"""Bounded deterministic candidate search using a selected synthetic product profile."""
import hashlib
import json
import numpy as np
import pandas as pd
from scipy.stats import qmc

from ml.product_profiles import FEATURES, TARGETS, DISCLAIMER
from .schemas import OptimizeRequest

SAMPLE_COUNT = 10_000

def constraint_checks(responses, constraints):
    return {key: bool(responses[key.rpartition("_")[0]] >= bound if key.endswith("_min")
                      else responses[key.rpartition("_")[0]] <= bound)
            for key, bound in constraints.items()}

def optimize(payload: OptimizeRequest, predictor):
    profile = predictor.profile(payload.product_id)
    ranges = {factor["key"]: (factor["min"], factor["max"]) for factor in profile["factors"]}
    baseline = payload.baseline.model_dump()
    # Validates selected product and its product-specific input ranges.
    baseline_responses = predictor.predict(payload.product_id, baseline)["predicted_responses"]
    baseline_vector = np.array([baseline[f] for f in FEATURES])
    width = np.array([ranges[f][1] - ranges[f][0] for f in FEATURES])
    adjustable, limits = [], {}
    for feature in FEATURES:
        lo, hi = ranges[feature]
        if feature in payload.bounds: lo, hi = payload.bounds[feature].min, payload.bounds[feature].max
        if lo < ranges[feature][0] or hi > ranges[feature][1]: raise ValueError("Bounds outside selected product profile")
        if feature in payload.fixed: lo = hi = baseline[feature]
        limits[feature] = (lo, hi)
        if hi > lo: adjustable.append(feature)
    count = SAMPLE_COUNT if adjustable else 1
    X = pd.DataFrame(np.tile(baseline_vector, (count, 1)), columns=FEATURES)
    if adjustable:
        unit = qmc.LatinHypercube(d=len(adjustable), seed=payload.seed).random(n=count)
        X[adjustable] = qmc.scale(unit, [limits[f][0] for f in adjustable], [limits[f][1] for f in adjustable])
    Y = predictor.predict_batch(payload.product_id, X)
    valid = np.isfinite(Y).all(axis=1) & (Y >= 0).all(axis=1) & (Y[:, 1:3] <= 10).all(axis=1)
    distance = np.linalg.norm((X.to_numpy() - baseline_vector) / width, axis=1)
    feasible = valid & (distance > 1e-12)
    target_checks = {}
    for key, bound in payload.target_constraints.items():
        target, _, kind = key.rpartition("_"); values = Y[:, TARGETS.index(target)]
        check = values >= bound if kind == "min" else values <= bound
        target_checks[key] = int((check & valid).sum()); feasible &= check
    indices = np.flatnonzero(feasible)
    ranked = sorted(indices, key=lambda i: (float(distance[i]), -float(Y[i, 0]), float(Y[i, 1]), int(i)))
    chosen = []
    for index in ranked:
        if all(np.linalg.norm((X.iloc[index].to_numpy() - X.iloc[j].to_numpy()) / width) >= payload.min_distance for j in chosen):
            chosen.append(index)
        if len(chosen) >= payload.top_k: break
    candidates = []
    for rank, index in enumerate(chosen, 1):
        composition = {f: float(X.iloc[index][f]) for f in FEATURES}
        responses = dict(zip(TARGETS, Y[index].tolist()))
        identity = json.dumps({"product_id": payload.product_id, "composition": composition,
                               "model": predictor.metadata["model_version"]}, sort_keys=True)
        candidates.append({"candidate_id": "product-" + hashlib.sha256(identity.encode()).hexdigest()[:16],
            "rank": rank, "composition": composition, "predicted_responses": responses,
            "composition_delta": {f: composition[f] - baseline[f] for f in FEATURES},
            "predicted_response_delta": {t: responses[t] - baseline_responses[t] for t in TARGETS},
            "normalized_change_distance": float(distance[index]),
            "constraint_checks": constraint_checks(responses, payload.target_constraints), "status": "PREDICTED_FEASIBLE"})
    return {"mode": "model_assisted_product_search", "status": "CANDIDATES_FOUND" if candidates else "NO_FEASIBLE_ALTERNATIVE_FOUND",
        "model_version": predictor.metadata["model_version"], "product": profile,
        "data_origin": predictor.metadata["data_origin"],
        "baseline": {"composition": baseline, "predicted_responses": baseline_responses,
                     "constraint_checks": constraint_checks(baseline_responses, payload.target_constraints)},
        "target_constraints": payload.target_constraints, "fixed": payload.fixed,
        "effective_bounds": {f: {"min": lo, "max": hi} for f, (lo, hi) in limits.items()},
        "process": {"sampled_count": count, "valid_output_count": int(valid.sum()),
                    "feasible_alternative_count": int(feasible.sum()), "per_target_pass_count": target_checks,
                    "returned_count": len(candidates), "seed": payload.seed,
                    "ranking": "normalized composition change ascending; hydration descending; stickiness ascending",
                    "min_diversity_distance": payload.min_distance},
        "candidates": candidates,
        "limitations": ["Product names are identifiers; factor profiles and baselines are synthetic prototype data.",
            "Three formulation factors, not a complete commercial formula.",
            "Holdout metrics measure synthetic-equation interpolation, not laboratory accuracy.",
            "Empty search is not proof of global infeasibility.",
            "Safety, stability, efficacy, cost, sustainability and process effects are not predicted."],
        "disclaimer": DISCLAIMER}
