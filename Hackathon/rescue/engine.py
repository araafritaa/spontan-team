"""Historical candidate search and ranking for FormulaRescue Stage 3."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from xgboost import XGBClassifier


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_PATH = PROJECT_ROOT / "data" / "processed" / "formulations_clean.csv"
DEFAULT_INGREDIENT_METADATA_PATH = (
    PROJECT_ROOT / "data" / "processed" / "ingredient_metadata.csv"
)
DEFAULT_MODEL_PATH = PROJECT_ROOT / "ml" / "artifacts" / "stability_model.json"
DEFAULT_MODEL_METADATA_PATH = (
    PROJECT_ROOT / "ml" / "artifacts" / "model_metadata.json"
)

DISCLAIMER = "Predicted / estimated and requires physical laboratory validation."
CHANGE_EPSILON = 0.01
CONSTRAINT_EPSILON = 1e-9
COMPOSITION_TOLERANCE = 1e-6
DISTANCE_SCALE = 100.0
MAX_TOP_K = 10

DEFAULT_WEIGHTS = {
    "predicted_stability": 0.50,
    "formula_similarity": 0.35,
    "minimal_changes": 0.15,
}


class RescueValidationError(ValueError):
    """Raised when a rescue request is invalid or cannot produce candidates."""


class RescueEngine:
    """Find and rank historical stable formulas under one unavailable ingredient."""

    def __init__(
        self,
        data_path: Path = DEFAULT_DATA_PATH,
        ingredient_metadata_path: Path = DEFAULT_INGREDIENT_METADATA_PATH,
        model_path: Path = DEFAULT_MODEL_PATH,
        model_metadata_path: Path = DEFAULT_MODEL_METADATA_PATH,
        weights: dict[str, float] | None = None,
    ) -> None:
        self.data = pd.read_csv(data_path)
        self.ingredient_metadata = pd.read_csv(ingredient_metadata_path)
        self.model_metadata = json.loads(model_metadata_path.read_text(encoding="utf-8"))
        self.feature_columns = list(self.model_metadata["feature_columns"])
        self.weights = dict(weights or DEFAULT_WEIGHTS)

        self._validate_startup_contract()
        self.model = XGBClassifier()
        self.model.load_model(model_path)

        metadata_by_feature = self.ingredient_metadata.set_index("feature_name")
        self.display_names = metadata_by_feature["display_name"].to_dict()
        self.ingredient_types = metadata_by_feature["ingredient_type"].to_dict()
        self.feature_minimums = self.data[self.feature_columns].min()
        self.feature_maximums = self.data[self.feature_columns].max()

    def _validate_startup_contract(self) -> None:
        required_columns = set(
            ["formula_id", "is_stable", "water_pct", *self.feature_columns]
        )
        missing = required_columns.difference(self.data.columns)
        if missing:
            raise RescueValidationError(
                f"Processed dataset is missing required columns: {sorted(missing)}"
            )

        metadata_features = set(self.ingredient_metadata["feature_name"])
        if not set(self.feature_columns).issubset(metadata_features):
            raise RescueValidationError(
                "Ingredient metadata does not cover every model feature"
            )

        if len(self.feature_columns) != 18:
            raise RescueValidationError("Expected exactly 18 ingredient features")
        if not np.isclose(sum(self.weights.values()), 1.0):
            raise RescueValidationError("Rescue ranking weights must sum to 1.0")
        if set(self.weights) != set(DEFAULT_WEIGHTS):
            raise RescueValidationError(
                f"Rescue weights must use keys: {sorted(DEFAULT_WEIGHTS)}"
            )

    def resolve_ingredient(self, ingredient: str) -> str:
        """Resolve either a feature name or human-readable display name."""
        normalized = ingredient.strip().casefold()
        direct_matches = {
            feature.casefold(): feature for feature in self.feature_columns
        }
        display_matches = {
            str(self.display_names[feature]).casefold(): feature
            for feature in self.feature_columns
        }
        resolved = direct_matches.get(normalized) or display_matches.get(normalized)
        if resolved is None:
            choices = ", ".join(self.display_names[feature] for feature in self.feature_columns)
            raise RescueValidationError(
                f"Unknown ingredient '{ingredient}'. Available ingredients: {choices}"
            )
        return resolved

    def get_formula(self, formula_id: int) -> pd.Series:
        matches = self.data.loc[self.data["formula_id"] == formula_id]
        if matches.empty:
            raise RescueValidationError(f"Formula ID {formula_id} was not found")
        return matches.iloc[0]

    def formula_summary(self, formula_id: int) -> dict[str, Any]:
        """Return one formula in a JSON-friendly structure."""
        return self._formula_summary(self.get_formula(formula_id))

    def stable_formula_ids(self) -> list[int]:
        """Return experimentally stable formula IDs in ascending order."""
        stable_ids = self.data.loc[self.data["is_stable"] == 1, "formula_id"]
        return sorted(int(formula_id) for formula_id in stable_ids)

    def available_ingredients(self, formula_id: int) -> list[dict[str, Any]]:
        formula = self.get_formula(formula_id)
        return [
            {
                "feature_name": feature,
                "display_name": self.display_names[feature],
                "concentration_pct": float(formula[feature]),
            }
            for feature in self.feature_columns
            if float(formula[feature]) > CONSTRAINT_EPSILON
        ]

    def reformulate(
        self,
        formula_id: int,
        unavailable_ingredient: str,
        top_k: int = 3,
    ) -> dict[str, Any]:
        if not 1 <= top_k <= MAX_TOP_K:
            raise RescueValidationError(
                f"top_k must be between 1 and {MAX_TOP_K}"
            )

        original = self.get_formula(formula_id)
        if int(original["is_stable"]) != 1:
            raise RescueValidationError(
                "Original formula must be experimentally labelled stable"
            )

        unavailable_feature = self.resolve_ingredient(unavailable_ingredient)
        if float(original[unavailable_feature]) <= CONSTRAINT_EPSILON:
            raise RescueValidationError(
                f"{self.display_names[unavailable_feature]} is not present in formula {formula_id}"
            )

        candidates = self.data.loc[
            (self.data["formula_id"] != formula_id)
            & (self.data["is_stable"] == 1)
            & (self.data[unavailable_feature].abs() <= CONSTRAINT_EPSILON)
        ].copy()
        candidates = self._apply_hard_constraints(candidates, unavailable_feature)
        if candidates.empty:
            raise RescueValidationError(
                "No historical stable candidate satisfies the requested constraint"
            )

        differences = candidates[self.feature_columns].sub(
            original[self.feature_columns].astype(float), axis="columns"
        ).abs()
        candidates["formula_distance"] = differences.sum(axis=1)
        candidates["formula_similarity"] = (
            1.0 - candidates["formula_distance"] / DISTANCE_SCALE
        ).clip(lower=0.0, upper=1.0)
        candidates["number_of_changes"] = differences.ge(CHANGE_EPSILON).sum(axis=1)
        candidates["minimal_changes"] = 1.0 - (
            candidates["number_of_changes"] / len(self.feature_columns)
        )
        candidates["predicted_stability"] = self.model.predict_proba(
            candidates[self.feature_columns]
        )[:, 1]
        candidates["rescue_score"] = (
            self.weights["predicted_stability"] * candidates["predicted_stability"]
            + self.weights["formula_similarity"] * candidates["formula_similarity"]
            + self.weights["minimal_changes"] * candidates["minimal_changes"]
        )

        ranked = candidates.sort_values(
            by=[
                "rescue_score",
                "predicted_stability",
                "formula_similarity",
                "formula_id",
            ],
            ascending=[False, False, False, True],
            kind="mergesort",
        ).head(top_k)

        results = [
            self._candidate_result(rank, row, original, differences.loc[index])
            for rank, (index, row) in enumerate(ranked.iterrows(), start=1)
        ]

        return {
            "mode": "historical_rescue_search",
            "original_formula": self._formula_summary(original),
            "constraint": {
                "type": "ingredient_unavailable",
                "feature_name": unavailable_feature,
                "display_name": self.display_names[unavailable_feature],
                "original_concentration_pct": float(original[unavailable_feature]),
            },
            "eligible_candidate_count": int(len(candidates)),
            "ranking_weights": self.weights,
            "candidates": results,
            "disclaimer": DISCLAIMER,
        }

    def _apply_hard_constraints(
        self, candidates: pd.DataFrame, unavailable_feature: str
    ) -> pd.DataFrame:
        composition_columns = [*self.feature_columns, "water_pct"]
        valid = candidates[composition_columns].ge(-CONSTRAINT_EPSILON).all(axis=1)
        valid &= candidates[composition_columns].sum(axis=1).sub(100).abs().le(
            COMPOSITION_TOLERANCE
        )
        valid &= candidates[unavailable_feature].abs().le(CONSTRAINT_EPSILON)
        valid &= candidates[self.feature_columns].ge(
            self.feature_minimums - CONSTRAINT_EPSILON
        ).all(axis=1)
        valid &= candidates[self.feature_columns].le(
            self.feature_maximums + CONSTRAINT_EPSILON
        ).all(axis=1)
        return candidates.loc[valid].copy()

    def _formula_summary(self, formula: pd.Series) -> dict[str, Any]:
        ingredients = self._composition_list(formula)
        return {
            "formula_id": int(formula["formula_id"]),
            "historical_observed_stability": bool(formula["is_stable"]),
            "ingredients": ingredients,
        }

    def _composition_list(self, formula: pd.Series) -> list[dict[str, Any]]:
        composition_features = [*self.feature_columns, "water_pct"]
        return [
            {
                "feature_name": feature,
                "display_name": self.display_names.get(feature, "Water"),
                "ingredient_type": self.ingredient_types.get(feature, "solvent"),
                "concentration_pct": float(formula[feature]),
            }
            for feature in composition_features
            if float(formula[feature]) > CONSTRAINT_EPSILON
        ]

    def _candidate_result(
        self,
        rank: int,
        candidate: pd.Series,
        original: pd.Series,
        differences: pd.Series,
    ) -> dict[str, Any]:
        changed_features = [
            feature
            for feature in self.feature_columns
            if float(differences[feature]) >= CHANGE_EPSILON
        ]
        changed_ingredients = [
            {
                "feature_name": feature,
                "display_name": self.display_names[feature],
                "original_pct": float(original[feature]),
                "candidate_pct": float(candidate[feature]),
                "absolute_change_pct": float(differences[feature]),
            }
            for feature in changed_features
        ]

        return {
            "rank": rank,
            "formula_id": int(candidate["formula_id"]),
            "predicted_stability": float(candidate["predicted_stability"]),
            "historical_observed_stability": bool(candidate["is_stable"]),
            "formula_similarity": float(candidate["formula_similarity"]),
            "formula_distance": float(candidate["formula_distance"]),
            "number_of_changes": int(candidate["number_of_changes"]),
            "rescue_score": float(candidate["rescue_score"]),
            "constraint_passed": True,
            "changed_ingredients": changed_ingredients,
            "ingredients": self._composition_list(candidate),
        }
