"""Request and response contracts for the FormulaRescue API."""

from typing import Literal

from pydantic import BaseModel, Field


class Ingredient(BaseModel):
    feature_name: str
    display_name: str
    ingredient_type: str | None = None
    concentration_pct: float


class IngredientOption(BaseModel):
    feature_name: str
    display_name: str
    concentration_pct: float


class FormulaSummary(BaseModel):
    formula_id: int
    historical_observed_stability: bool
    ingredients: list[Ingredient]
    unavailable_ingredient_options: list[IngredientOption]


class FormulaListResponse(BaseModel):
    total: int
    offset: int
    limit: int
    count: int
    formulas: list[FormulaSummary]


class UnavailableIngredientConstraint(BaseModel):
    type: Literal["ingredient_unavailable"]
    ingredient: str = Field(min_length=1)


class ReformulateRequest(BaseModel):
    formula_id: int
    constraint: UnavailableIngredientConstraint
    top_k: int = Field(default=3, ge=1, le=10)


class ChangedIngredient(BaseModel):
    feature_name: str
    display_name: str
    original_pct: float
    candidate_pct: float
    absolute_change_pct: float


class Candidate(BaseModel):
    rank: int
    formula_id: int
    predicted_stability: float
    historical_observed_stability: bool
    formula_similarity: float
    formula_distance: float
    number_of_changes: int
    rescue_score: float
    constraint_passed: bool
    changed_ingredients: list[ChangedIngredient]
    ingredients: list[Ingredient]


class ConstraintResult(BaseModel):
    type: Literal["ingredient_unavailable"]
    feature_name: str
    display_name: str
    original_concentration_pct: float


class OriginalFormula(BaseModel):
    formula_id: int
    historical_observed_stability: bool
    ingredients: list[Ingredient]


class ReformulateResponse(BaseModel):
    mode: str
    original_formula: OriginalFormula
    constraint: ConstraintResult
    eligible_candidate_count: int
    ranking_weights: dict[str, float]
    candidates: list[Candidate]
    disclaimer: str


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    stage: int
