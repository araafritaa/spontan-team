import { FACTORS, type Feature, type OptimizationRequest, type ProductProfile } from "./reformulation-api";
export type IngredientDraft = { feature: Feature; name: string; concentration: number; fixed: boolean; min: number; max: number; profileMin: number; profileMax: number };
export type ReformulationDraft = { productId: string; brand: string; product: string; category: string; insight: string; insightOrigin: "manual" | "library";
  target: "hydration" | "stickiness"; direction: "increase" | "decrease"; preserve: string; targetValue: number; stickinessLimit: number | null;
  ingredients: IngredientDraft[]; temperature: number; speed: number; duration: number; confirmed: boolean };
export function initialDraft(insight = ""): ReformulationDraft {
  return { productId: "", brand: "", product: "", category: "", insight, insightOrigin: insight ? "library" : "manual",
    target: "hydration", direction: "increase", targetValue: 1.25, stickinessLimit: 4.5,
    preserve: "Existing product identity and safety requirements", confirmed: false,
    ingredients: FACTORS.map((factor, index) => ({ feature: factor.feature, name: `Factor ${String.fromCharCode(65 + index)}`,
      concentration: 0, fixed: false, min: 0, max: 0, profileMin: 0, profileMax: 0 })), temperature: 70, speed: 3000, duration: 10 };
}
export function selectProduct(draft: ReformulationDraft, profile: ProductProfile): ReformulationDraft {
  return { ...draft, productId: profile.product_id, brand: profile.brand, product: profile.product_name, category: profile.category_name,
    ingredients: profile.factors.map(f => ({ feature: f.key, name: f.label, concentration: f.baseline, fixed: false, min: f.min, max: f.max, profileMin: f.min, profileMax: f.max })),
    confirmed: false };
}
export function validateStep(step: number, draft: ReformulationDraft): string {
  if (step === 0 && (!draft.productId || !draft.brand || !draft.product || !draft.category)) return "Choose a brand and product from the model catalog.";
  if (step === 1 && (!draft.insight.trim() || !draft.confirmed)) return "Enter an insight and confirm the technical R&D target.";
  if (step === 1 && (!Number.isFinite(draft.targetValue) || draft.targetValue < 0 || draft.targetValue > (draft.target === "stickiness" ? 10 : 1000000))) return "Enter a valid target: hydration ratio ≥ 0 or stickiness score 0–10.";
  if (step === 1 && draft.target === "hydration" && draft.stickinessLimit !== null && (!Number.isFinite(draft.stickinessLimit) || draft.stickinessLimit < 0 || draft.stickinessLimit > 10)) return "Stickiness limit must be between 0 and 10.";
  if (step === 2) {
    if (draft.ingredients.length !== 3 || !FACTORS.every(f => draft.ingredients.filter(i => i.feature === f.feature).length === 1)) return "The profile must contain exactly three factors.";
    for (const ingredient of draft.ingredients) {
      if (!Number.isFinite(ingredient.concentration) || (![ingredient.min, ingredient.max].every(Number.isFinite))) return "Concentrations and bounds must be finite numbers.";
      if (ingredient.min < ingredient.profileMin || ingredient.max > ingredient.profileMax || ingredient.min > ingredient.max || ingredient.concentration < ingredient.min || ingredient.concentration > ingredient.max) return `Check the synthetic profile bounds for ${ingredient.name}.`;
    }
    if (draft.ingredients.reduce((sum, item) => sum + item.concentration, 0) > 100) return "The total concentration of the three factors must not exceed 100%.";
    if (![draft.temperature, draft.speed, draft.duration].every(Number.isFinite) || draft.temperature < 0 || draft.temperature > 150 || draft.speed <= 0 || draft.duration <= 0) return "Check temperature (0–150 °C) and positive mixing speed and duration.";
  }
  return "";
}
export function buildOptimizationRequest(draft: ReformulationDraft): OptimizationRequest {
  for (let step = 0; step <= 2; step++) { const error = validateStep(step, draft); if (error) throw new Error(error); }
  const baseline = Object.fromEntries(draft.ingredients.map(i => [i.feature, i.concentration])) as OptimizationRequest["baseline"];
  const key = `${draft.target === "hydration" ? "hydration_ratio" : "stickiness_score_0_10"}_${draft.direction === "increase" ? "min" : "max"}` as keyof OptimizationRequest["target_constraints"];
  const target_constraints: OptimizationRequest["target_constraints"] = { [key]: draft.targetValue };
  if (draft.target === "hydration" && draft.stickinessLimit !== null) target_constraints.stickiness_score_0_10_max = draft.stickinessLimit;
  return { product_id: draft.productId, baseline, target_constraints,
    bounds: Object.fromEntries(draft.ingredients.filter(i => !i.fixed).map(i => [i.feature, { min: i.min, max: i.max }])),
    fixed: draft.ingredients.filter(i => i.fixed).map(i => i.feature), top_k: 3, seed: 42, min_distance: .03 };
}
