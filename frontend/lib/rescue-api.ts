export type Ingredient = { feature_name: string; display_name: string; ingredient_type?: string | null; concentration_pct: number };
export type FormulaSummary = { formula_id: number; historical_observed_stability: boolean; ingredients: Ingredient[]; unavailable_ingredient_options: Ingredient[] };
export type RescueCandidate = {
  rank: number; formula_id: number; predicted_stability: number; historical_observed_stability: boolean;
  formula_similarity: number; formula_distance: number; number_of_changes: number; rescue_score: number; constraint_passed: boolean;
  changed_ingredients: { feature_name: string; display_name: string; original_pct: number; candidate_pct: number; absolute_change_pct: number }[];
  ingredients: Ingredient[];
};
export type ReformulateResponse = {
  mode: string; original_formula: { formula_id: number; historical_observed_stability: boolean; ingredients: Ingredient[] };
  constraint: { type: "ingredient_unavailable"; feature_name: string; display_name: string; original_concentration_pct: number };
  eligible_candidate_count: number; ranking_weights: Record<string, number>; candidates: RescueCandidate[]; disclaimer: string;
};
type FormulaPage = { total: number; offset: number; count: number; formulas: FormulaSummary[] };
export const rescueApiBase = "/api/formula-rescue";
async function read<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : "API tidak dapat menyelesaikan request.");
  if (!body) throw new Error("Respons API tidak valid.");
  return body as T;
}
export async function getAllFormulas(signal?: AbortSignal): Promise<FormulaSummary[]> {
  const first = await read<FormulaPage>(await fetch(rescueApiBase + "/formulas?offset=0&limit=100", { signal }));
  if (!Number.isInteger(first.total) || first.total < 0 || first.total > 10000 || !Array.isArray(first.formulas)) throw new Error("Daftar formula API tidak valid.");
  const offsets = [];
  for (let offset = 100; offset < first.total; offset += 100) offsets.push(offset);
  const pages = await Promise.all(offsets.map(async offset => read<FormulaPage>(await fetch(rescueApiBase + "/formulas?offset=" + offset + "&limit=100", { signal }))));
  return [first, ...pages].flatMap(page => page.formulas).sort((a,b) => a.formula_id - b.formula_id);
}
export async function reformulate(formulaId: number, ingredient: string, signal?: AbortSignal): Promise<ReformulateResponse> {
  const result = await read<ReformulateResponse>(await fetch(rescueApiBase + "/reformulate", {
    method: "POST", headers: { "Content-Type": "application/json" }, signal,
    body: JSON.stringify({ formula_id: formulaId, constraint: { type: "ingredient_unavailable", ingredient }, top_k: 8 }),
  }));
  if (!Array.isArray(result.candidates) || !result.original_formula || !result.constraint) throw new Error("Hasil rescue API tidak valid.");
  return result;
}
