export const AI_DISCLAIMER = "Predicted / estimated and requires physical laboratory validation.";
export const FACTORS = [
  { feature: "factor_a_pct" }, { feature: "factor_b_pct" }, { feature: "factor_c_pct" },
] as const;
export const RESPONSES = [
  { key: "hydration_ratio", name: "Hydration", unit: "ratio" },
  { key: "stickiness_score_0_10", name: "Stickiness", unit: "score 0–10" },
  { key: "oiliness_score_0_10", name: "Oiliness", unit: "score 0–10" },
  { key: "consistency_index", name: "Consistency", unit: "synthetic index" },
] as const;
export type Feature = typeof FACTORS[number]["feature"];
export type ResponseKey = typeof RESPONSES[number]["key"];
export type Composition = Record<Feature, number>;
export type SensoryResponses = Record<ResponseKey, number>;
export type TargetKey = `${ResponseKey}_${"min" | "max"}`;
export type Targets = Partial<Record<TargetKey, number>>;
export type ProductFactor = { key: Feature; label: string; unit: "%"; min: number; max: number; baseline: number };
export type ProductProfile = { product_id: string; brand: string; product_name: string; category_id: string;
  category_name: string; factors: [ProductFactor, ProductFactor, ProductFactor]; profile_origin: "SYNTHETIC_PROTOTYPE_DATA" };
export type ProductCatalog = { catalog_version: string; data_origin: "SYNTHETIC_PROTOTYPE_DATA"; notice: string;
  products: ProductProfile[]; disclaimer: string };
export type OptimizationRequest = {
  product_id: string; baseline: Composition; target_constraints: Targets;
  bounds: Partial<Record<Feature, { min: number; max: number }>>;
  fixed: Feature[]; top_k: number; seed: number; min_distance: number;
};
export type Prediction = { model_version: string; product: ProductProfile; data_origin: "SYNTHETIC_PROTOTYPE_DATA";
  predicted_responses: SensoryResponses; disclaimer: string };
export type Candidate = { candidate_id: string; rank: number; composition: Composition; predicted_responses: SensoryResponses;
  composition_delta: Composition; predicted_response_delta: SensoryResponses; normalized_change_distance: number;
  constraint_checks: Partial<Record<TargetKey, boolean>>; status: "PREDICTED_FEASIBLE" };
export type OptimizationResult = {
  mode: "model_assisted_product_search"; status: "CANDIDATES_FOUND" | "NO_FEASIBLE_ALTERNATIVE_FOUND";
  model_version: string; product: ProductProfile; data_origin: "SYNTHETIC_PROTOTYPE_DATA";
  baseline: { composition: Composition; predicted_responses: SensoryResponses; constraint_checks: Partial<Record<TargetKey, boolean>> };
  target_constraints: Targets; fixed: Feature[]; effective_bounds: Record<Feature, { min: number; max: number }>;
  process: { sampled_count: number; valid_output_count: number; feasible_alternative_count: number;
    per_target_pass_count: Partial<Record<TargetKey, number>>; returned_count: number; seed: number; ranking: string; min_diversity_distance: number };
  candidates: Candidate[]; limitations: string[]; disclaimer: string;
};
function object(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function product(value: unknown): value is ProductProfile {
  return object(value) && typeof value.product_id === "string" && typeof value.brand === "string" && typeof value.product_name === "string" &&
    typeof value.category_id === "string" && typeof value.category_name === "string" && value.profile_origin === "SYNTHETIC_PROTOTYPE_DATA" &&
    Array.isArray(value.factors) && value.factors.length === 3 && value.factors.every((f, i) => object(f) && f.key === FACTORS[i].feature &&
      typeof f.label === "string" && f.unit === "%" && finite(f.min) && finite(f.max) && finite(f.baseline) && f.min <= f.baseline && f.baseline <= f.max);
}
function responses(value: unknown): boolean { return object(value) && RESPONSES.every(r => finite(value[r.key]) && (value[r.key] as number) >= 0) &&
  (value.stickiness_score_0_10 as number) <= 10 && (value.oiliness_score_0_10 as number) <= 10; }
function composition(value: unknown, profile: ProductProfile): boolean { return object(value) && profile.factors.every(f => finite(value[f.key]) &&
  (value[f.key] as number) >= f.min && (value[f.key] as number) <= f.max); }
function provenance(value: Record<string, unknown>): boolean { return typeof value.model_version === "string" && !!value.model_version &&
  value.data_origin === "SYNTHETIC_PROTOTYPE_DATA" && value.disclaimer === AI_DISCLAIMER; }
export function validateOptimization(value: unknown): asserts value is OptimizationResult {
  const invalid = () => { throw new Error("Invalid optimizer response. No substitute predictions are fabricated."); };
  if (!object(value) || !provenance(value) || value.mode !== "model_assisted_product_search" || !product(value.product) ||
      !object(value.baseline) || !composition(value.baseline.composition, value.product) || !responses(value.baseline.predicted_responses) ||
      !object(value.baseline.constraint_checks) || !object(value.target_constraints) || !Object.keys(value.target_constraints).length ||
      !Object.values(value.target_constraints).every(finite) || !object(value.process) || !Array.isArray(value.candidates) || value.candidates.length > 3 ||
      !Array.isArray(value.limitations) || !value.limitations.every(x => typeof x === "string") || !Array.isArray(value.fixed) || !object(value.effective_bounds)) return invalid();
  const result = value as unknown as OptimizationResult;
  const keys = Object.keys(result.target_constraints) as TargetKey[];
  const allowed = RESPONSES.flatMap(r => [`${r.key}_min`, `${r.key}_max`]);
  if (!keys.every(k => allowed.includes(k) && typeof result.baseline.constraint_checks[k] === "boolean" &&
      Number.isInteger(result.process.per_target_pass_count?.[k]) && result.process.per_target_pass_count[k]! >= 0 &&
      result.process.per_target_pass_count[k]! <= result.process.valid_output_count) || !result.fixed.every(f => FACTORS.some(row => row.feature === f))) return invalid();
  if ((result.candidates.length ? "CANDIDATES_FOUND" : "NO_FEASIBLE_ALTERNATIVE_FOUND") !== result.status) return invalid();
  const counts = [result.process.sampled_count, result.process.valid_output_count, result.process.feasible_alternative_count, result.process.returned_count];
  if (!counts.every(n => Number.isInteger(n) && n >= 0 && n <= 10000) || result.process.valid_output_count > result.process.sampled_count ||
      result.process.feasible_alternative_count > result.process.valid_output_count || result.process.returned_count !== result.candidates.length ||
      !object(result.process.per_target_pass_count) || typeof result.process.ranking !== "string" || !Number.isInteger(result.process.seed) ||
      !finite(result.process.min_diversity_distance)) return invalid();
  if (!FACTORS.every(f => object(result.effective_bounds[f.feature]) && finite(result.effective_bounds[f.feature].min) && finite(result.effective_bounds[f.feature].max))) return invalid();
  const ids = new Set<string>();
  for (const [index, c] of result.candidates.entries()) {
    if (!object(c) || typeof c.candidate_id !== "string" || !c.candidate_id || ids.has(c.candidate_id) || c.rank !== index + 1 ||
        c.status !== "PREDICTED_FEASIBLE" || !composition(c.composition, result.product) || !responses(c.predicted_responses) ||
        !object(c.composition_delta) || !object(c.predicted_response_delta) || !FACTORS.every(f => finite(c.composition_delta[f.feature])) ||
        !RESPONSES.every(r => finite(c.predicted_response_delta[r.key])) || !finite(c.normalized_change_distance) || c.normalized_change_distance < 0 ||
        !object(c.constraint_checks) || !Object.keys(result.target_constraints).every(k => c.constraint_checks[k as TargetKey] === true)) return invalid();
    ids.add(c.candidate_id);
  }
}
async function parse(response: Response, fallback: string): Promise<unknown> {
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(object(value) && typeof value.detail === "string" ? value.detail : fallback);
  return value;
}
export async function fetchProductCatalog(signal?: AbortSignal): Promise<ProductCatalog> {
  const response = await fetch("/api/ai-reformulation/products", { cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) })
    .catch(cause => { if (signal?.aborted) throw cause; throw new Error("The product catalog could not be loaded from the engine."); });
  const value = await parse(response, "Product catalog unavailable.");
  if (!object(value) || value.data_origin !== "SYNTHETIC_PROTOTYPE_DATA" || value.disclaimer !== AI_DISCLAIMER || typeof value.notice !== "string" ||
      !Array.isArray(value.products) || !value.products.length || !value.products.every(product)) throw new Error("Invalid product catalog response.");
  return value as unknown as ProductCatalog;
}
async function request(action: "predict" | "optimize", body: unknown, signal?: AbortSignal): Promise<unknown> {
  const timeout = AbortSignal.timeout(50000);
  const response = await fetch("/api/ai-reformulation/" + action, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout })
    .catch(cause => { if (signal?.aborted) throw cause; throw new Error("AI engine connection failed or timed out. Please try again."); });
  return parse(response, "The AI engine could not process this request.");
}
export async function predictComposition(productId: string, input: Composition, signal?: AbortSignal): Promise<Prediction> {
  const value = await request("predict", { product_id: productId, composition: input }, signal);
  if (!object(value) || !provenance(value) || !product(value.product) || value.product.product_id !== productId || !responses(value.predicted_responses)) throw new Error("Invalid baseline prediction response.");
  return value as unknown as Prediction;
}
export async function optimizeComposition(input: OptimizationRequest, signal?: AbortSignal): Promise<OptimizationResult> {
  const value = await request("optimize", input, signal); validateOptimization(value);
  if (value.product.product_id !== input.product_id) throw new Error("The optimizer product does not match the request.");
  return value;
}
