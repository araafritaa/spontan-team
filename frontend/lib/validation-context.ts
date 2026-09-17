import type { Candidate, OptimizationResult, OptimizationRequest } from "./reformulation-api";
import type { RescueCandidate, ReformulateResponse } from "./rescue-api";
import type { ValidationContext } from "./lab-validation";
export function reformulationValidationContext(result: OptimizationResult, candidate: Candidate,
  request: OptimizationRequest | null, insight: string): ValidationContext {
  return { engine: "reformulation", candidateId: candidate.candidate_id,
    title: result.product.product_name + " / Candidate #" + candidate.rank,
    modelVersion: result.model_version, dataOrigin: result.data_origin, insight,
    predictions: candidate.predicted_responses, composition: candidate.composition,
    executedRequest: request ?? { product_id: result.product.product_id, baseline: result.baseline.composition,
      target_constraints: result.target_constraints, effective_bounds: result.effective_bounds, fixed: result.fixed, seed: result.process.seed } };
}
export function rescueValidationContext(result: ReformulateResponse, candidate: RescueCandidate, insight: string): ValidationContext {
  return { engine: "rescue", candidateId: String(candidate.formula_id),
    title: "Formula " + candidate.formula_id + " / Candidate #" + candidate.rank,
    modelVersion: result.model_version ?? "legacy-stability-model", dataOrigin: "HISTORICAL_FORMULATION_DATA", insight,
    predictions: { predicted_stability: candidate.predicted_stability }, composition: candidate.ingredients,
    executedRequest: { formula_id: result.original_formula.formula_id, constraint: result.constraint,
      ranking_weights: result.ranking_weights, catalog_version: result.catalog_version ?? "legacy-catalog" } };
}
