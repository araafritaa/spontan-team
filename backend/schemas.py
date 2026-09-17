"""Strict request contracts for the two independent formulation domains."""
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator
from Hackathon.backend.schemas import FormulaListResponse, ReformulateResponse

Feature = Literal["factor_a_pct", "factor_b_pct", "factor_c_pct"]
ConstraintKey = Literal["hydration_ratio_min", "hydration_ratio_max",
    "stickiness_score_0_10_min", "stickiness_score_0_10_max",
    "oiliness_score_0_10_min", "oiliness_score_0_10_max", "consistency_index_min", "consistency_index_max"]
FiniteBound = Annotated[float, Field(strict=True, allow_inf_nan=False, ge=0, le=1_000_000)]

class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)

class CatalogResponse(FormulaListResponse):
    catalog_version: str

class UnifiedRescueResponse(ReformulateResponse):
    model_version: str
    catalog_version: str

class ProductFactor(StrictModel):
    key: Feature
    label: str
    unit: Literal["%"]
    min: float
    max: float
    baseline: float

class ProductProfile(StrictModel):
    product_id: str
    brand: str
    product_name: str
    category_id: str
    category_name: str
    factors: list[ProductFactor] = Field(min_length=3, max_length=3)
    profile_origin: Literal["SYNTHETIC_PROTOTYPE_DATA"]

class ProductCatalogResponse(StrictModel):
    catalog_version: str
    data_origin: Literal["SYNTHETIC_PROTOTYPE_DATA"]
    notice: str
    products: list[ProductProfile]
    disclaimer: Literal["Predicted / estimated and requires physical laboratory validation."]

class Composition(StrictModel):
    factor_a_pct: float = Field(ge=0, le=100)
    factor_b_pct: float = Field(ge=0, le=100)
    factor_c_pct: float = Field(ge=0, le=100)

class Bounds(StrictModel):
    min: float = Field(ge=0, le=100)
    max: float = Field(ge=0, le=100)
    @model_validator(mode="after")
    def ordered(self):
        if self.min > self.max: raise ValueError("Minimum exceeds maximum")
        return self

class PredictRequest(StrictModel):
    product_id: str = Field(min_length=1, max_length=120)
    composition: Composition

class OptimizeRequest(StrictModel):
    product_id: str = Field(min_length=1, max_length=120)
    baseline: Composition
    target_constraints: dict[ConstraintKey, FiniteBound] = Field(min_length=1, max_length=8)
    bounds: dict[Feature, Bounds] = Field(default_factory=dict, max_length=3)
    fixed: list[Feature] = Field(default_factory=list, max_length=3)
    top_k: int = Field(default=3, ge=1, le=3)
    seed: int = Field(default=42, ge=0, le=4_294_967_295)
    min_distance: float = Field(default=.03, ge=0, le=.5)
    @model_validator(mode="after")
    def compatible(self):
        if len(self.fixed) != len(set(self.fixed)): raise ValueError("Duplicate fixed factors")
        baseline = self.baseline.model_dump()
        for feature, bound in self.bounds.items():
            if not bound.min <= baseline[feature] <= bound.max: raise ValueError("Baseline outside requested bounds")
        for key, value in self.target_constraints.items():
            target, _, kind = key.rpartition("_")
            other = self.target_constraints.get(target + "_max")
            if kind == "min" and other is not None and value > other: raise ValueError("Contradictory response bounds")
            if target in ("stickiness_score_0_10", "oiliness_score_0_10") and value > 10:
                raise ValueError("Sensory targets must be within 0-10")
        return self

class UnavailableConstraint(StrictModel):
    type: Literal["ingredient_unavailable"]
    ingredient: str = Field(min_length=1, max_length=200)

class RescueRequest(StrictModel):
    formula_id: int = Field(ge=1)
    constraint: UnavailableConstraint
    top_k: int = Field(default=3, ge=1, le=10)

class PredictedResponses(StrictModel):
    hydration_ratio: float = Field(ge=0)
    stickiness_score_0_10: float = Field(ge=0, le=10)
    oiliness_score_0_10: float = Field(ge=0, le=10)
    consistency_index: float = Field(ge=0)

class PredictionResponse(StrictModel):
    model_version: str
    product: ProductProfile
    predicted_responses: PredictedResponses
    data_origin: Literal["SYNTHETIC_PROTOTYPE_DATA"]
    disclaimer: Literal["Predicted / estimated and requires physical laboratory validation."]

class BaselineResult(StrictModel):
    composition: Composition
    predicted_responses: PredictedResponses
    constraint_checks: dict[ConstraintKey, bool]

class ResponseDelta(StrictModel):
    hydration_ratio: float
    stickiness_score_0_10: float
    oiliness_score_0_10: float
    consistency_index: float

class ReformulationCandidate(StrictModel):
    candidate_id: str
    rank: int = Field(ge=1, le=3)
    composition: Composition
    predicted_responses: PredictedResponses
    composition_delta: dict[Feature, Annotated[float, Field(allow_inf_nan=False)]]
    predicted_response_delta: ResponseDelta
    normalized_change_distance: float = Field(ge=0)
    constraint_checks: dict[ConstraintKey, bool]
    status: Literal["PREDICTED_FEASIBLE"]

class SearchProcess(StrictModel):
    sampled_count: int = Field(ge=1, le=10000)
    valid_output_count: int = Field(ge=0, le=10000)
    feasible_alternative_count: int = Field(ge=0, le=10000)
    per_target_pass_count: dict[ConstraintKey, int]
    returned_count: int = Field(ge=0, le=3)
    seed: int
    ranking: str
    min_diversity_distance: float

class OptimizationResponse(StrictModel):
    mode: Literal["model_assisted_product_search"]
    status: Literal["CANDIDATES_FOUND", "NO_FEASIBLE_ALTERNATIVE_FOUND"]
    model_version: str
    product: ProductProfile
    data_origin: Literal["SYNTHETIC_PROTOTYPE_DATA"]
    baseline: BaselineResult
    target_constraints: dict[ConstraintKey, FiniteBound]
    fixed: list[Feature]
    effective_bounds: dict[Feature, Bounds]
    process: SearchProcess
    candidates: list[ReformulationCandidate] = Field(max_length=3)
    limitations: list[str]
    disclaimer: Literal["Predicted / estimated and requires physical laboratory validation."]
