"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAllFormulas, reformulate, type FormulaSummary, type ReformulateResponse, type RescueCandidate } from "../lib/rescue-api";
import type { NewSessionAnalysis } from "../lib/session-analysis";
import CandidateValidation from "./candidate-validation";
import { rescueValidationContext } from "../lib/validation-context";
const percent = (value: number) => (value * 100).toFixed(1) + "%";
const RESCUE_BRANDS = ["Putri", "Wardah", "Emina", "Kahf", "LABORÉ"] as const;
type State = "idle" | "running" | "complete" | "error";
function Candidate({ candidate, onValidate }: { candidate: RescueCandidate; onValidate: (formulaId: number) => void }) {
  return <article className="rescue-candidate">
    <div className="rescue-card-head"><h3><span className="rank-number">#{candidate.rank}</span> Formula {candidate.formula_id}</h3><span className="badge">{candidate.constraint_passed ? "CONSTRAINT PASS" : "CONSTRAINT FAIL"}</span></div>
    <div className="rescue-metrics"><div><span>Estimated stability</span><strong>{percent(candidate.predicted_stability)}</strong></div><div><span>Composition similarity</span><strong>{percent(candidate.formula_similarity)}</strong></div><div><span>Ingredients changed</span><strong>{candidate.number_of_changes}</strong></div></div>
    <p className="rescue-score">Rescue score: <strong>{candidate.rescue_score.toFixed(3)}</strong> · ranking score, not probability of laboratory success.</p>
    <div className="trace-table-wrap"><table className="rescue-table"><caption>Composition changes · concentration percentages</caption><thead><tr><th scope="col">Ingredient</th><th scope="col">Original</th><th scope="col">Candidate</th></tr></thead><tbody>{candidate.changed_ingredients.map(change => <tr key={change.feature_name}><th scope="row">{change.display_name}</th><td>{change.original_pct.toFixed(2)}%</td><td>{change.candidate_pct.toFixed(2)}%</td></tr>)}</tbody></table></div>
    <button type="button" className="secondary candidate-lab-button" onClick={() => onValidate(candidate.formula_id)} aria-label={"Open lab validation for Formula " + candidate.formula_id}>Open Lab Validation <span aria-hidden="true">→</span></button>
  </article>;
}
export default function FormulaRescue({ onAnalysis, onOpenExperimental }: { onAnalysis?: (entry: NewSessionAnalysis) => void; onOpenExperimental?: (recordId: string) => void }) {
  const [formulas, setFormulas] = useState<FormulaSummary[]>([]);
  const [formulaId, setFormulaId] = useState<number | null>(null);
  const [ingredient, setIngredient] = useState("");
  const [brand, setBrand] = useState<string>(RESCUE_BRANDS[0]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [runError, setRunError] = useState("");
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<ReformulateResponse | null>(null);
  const [validationId, setValidationId] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);
  const activeRun = useRef<AbortController | null>(null);
  const formula = formulas.find(item => item.formula_id === formulaId);
  const reset = useCallback(() => { setValidationId(null); setResult(null); setRunError(""); setState("idle"); }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoadError(""); setFormulas([]); setFormulaId(null); setIngredient(""); reset();
    getAllFormulas(controller.signal).then(rows => {
      if (controller.signal.aborted) return;
      setFormulas(rows);
      const initial = rows.find(row => row.formula_id === 7) ?? rows[0];
      setFormulaId(initial?.formula_id ?? null);
      setIngredient(initial?.unavailable_ingredient_options[0]?.display_name ?? "");
    }).catch(error => { if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "Formula catalog could not be loaded."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry, reset]);
  useEffect(() => () => { activeRun.current?.abort(); }, []);
  async function run() {
    if (!formula || !ingredient || activeRun.current) return;
    const controller = new AbortController(); activeRun.current = controller;
    setValidationId(null); setResult(null); setRunError(""); setState("running");
    try {
      const response = await reformulate(formula.formula_id, ingredient, controller.signal);
      if (!controller.signal.aborted) {
        setResult(response); setState("complete");
        onAnalysis?.({ kind: "rescue", title: `${brand} / Formula ${formula.formula_id} rescue`, summary: response.candidates.length ? `${response.candidates.length} ranked candidates for replacing ${ingredient}.` : `No candidate found for replacing ${ingredient}.`, status: response.candidates.length ? "Completed" : "No candidates", insight: "", payload: { display_context: { brand, product: `Historical Formula ${formula.formula_id}`, category: "Shampoo", manufacturer_formula: false }, request: { formula_id: formula.formula_id, constraint: { type: "ingredient_unavailable", ingredient }, top_k: 8 }, response } });
      }
    } catch (error) {
      if (!controller.signal.aborted) { setRunError(error instanceof Error ? error.message : "Request failed."); setState("error"); }
    } finally { if (activeRun.current === controller) activeRun.current = null; }
  }
  const validationCandidate = result?.candidates.find(candidate => candidate.formula_id === validationId);
  if (validationCandidate && result) return <section className="rescue-feature rescue-lab-page">
    <button type="button" className="back" onClick={() => setValidationId(null)}>← Back to Ranked Candidates</button>
    <p className="eyebrow">FORMULA RESCUE / LAB VALIDATION</p><h1>Lab Validation</h1>
    <p>Save a testing plan, record physical laboratory results and review the prediction boundary.</p>
    <label htmlFor="rescue-lab-candidate">Candidate to validate</label>
    <select id="rescue-lab-candidate" value={validationId ?? ""} onChange={event => setValidationId(Number(event.target.value))}>
      {result.candidates.map(candidate => <option key={candidate.formula_id} value={candidate.formula_id}>Candidate #{candidate.rank} — Formula {candidate.formula_id}</option>)}
    </select>
    <p className="small-note">Display context: {brand} / Shampoo / Existing Formula {result.original_formula.formula_id}. Validation is linked to the historical candidate, not a manufacturer product.</p>
    <CandidateValidation context={rescueValidationContext(result, validationCandidate, "")} onOpenExperimental={onOpenExperimental}/>
  </section>;
  return <section className="rescue-feature">
    <p className="eyebrow">HISTORICAL FORMULA SEARCH</p><h1>Recover the formula.<br/><span>Preserve what works.</span></h1>
    <p>An observed-stable shampoo formulation + one unavailable ingredient → historical candidates for laboratory testing.</p>
    <span className="badge">{loading ? "LOADING FORMULAS" : loadError ? "ENGINE UNAVAILABLE" : formulas.length ? "DATA FROM API / NO MOCK FALLBACK" : "EMPTY FORMULA CATALOG"}</span>
    <div className="rescue-layout"><section className="rescue-setup"><h2>Define the constraint</h2>
      <label htmlFor="rescue-category">Product Category</label><input id="rescue-category" value="Shampoo" readOnly aria-describedby="rescue-context-note"/>
      <label htmlFor="rescue-brand">Brand</label><select id="rescue-brand" value={brand} disabled={state === "running"} onChange={event => setBrand(event.target.value)} aria-describedby="rescue-context-note">
        {RESCUE_BRANDS.map(name => <option key={name} value={name}>{name}</option>)}
      </select>
      <label htmlFor="rescue-formula">Existing Formula</label><select id="rescue-formula" value={formulaId ?? ""} disabled={loading || state === "running" || !formulas.length} onChange={event => { const next = formulas.find(row => row.formula_id === Number(event.target.value)); setFormulaId(next?.formula_id ?? null); setIngredient(next?.unavailable_ingredient_options[0]?.display_name ?? ""); reset(); }}>
        {loading ? <option value="">Loading formulations…</option> : !formulas.length ? <option value="">No formulations available</option> : formulas.map(row => <option key={row.formula_id} value={row.formula_id}>Formula {row.formula_id}</option>)}
      </select>
      <label htmlFor="rescue-ingredient">Unavailable Ingredient</label><select id="rescue-ingredient" value={ingredient} disabled={loading || state === "running" || !formula} onChange={event => { setIngredient(event.target.value); reset(); }}>
        {!formula?.unavailable_ingredient_options.length && <option value="">Select a formulation first</option>}
        {formula?.unavailable_ingredient_options.map(item => <option key={item.feature_name} value={item.display_name}>{item.display_name}</option>)}
      </select>
      <p id="rescue-context-note" className="small-note">Brand and product labels are display context only, not AI inputs. These historical shampoo formulations are not verified recipes from the selected brand. Changing brand does not change predictions; changing the existing formula or unavailable ingredient does.</p>
      <button className="primary" disabled={loading || state === "running" || !formula || !ingredient} onClick={() => void run()}>{state === "running" ? "Processing…" : "Run Formula Rescue"} →</button>
      {loadError && <div role="alert" className="rescue-error"><p>{loadError}</p><button className="back" onClick={() => setRetry(retry + 1)}>Retry formula catalog</button></div>}
      {!loading && !loadError && !formulas.length && <p>No observed-stable formulation is available.</p>}
      {formula && <><h3>Original composition <span className="badge">OBSERVED STABLE</span></h3><p>Formula {formula.formula_id}</p><div className="trace-table-wrap"><table className="rescue-table"><thead><tr><th scope="col">Ingredient</th><th scope="col">%</th></tr></thead><tbody>{formula.ingredients.map(item => <tr key={item.feature_name}><th scope="row">{item.display_name}</th><td>{item.concentration_pct.toFixed(2)}</td></tr>)}</tbody></table></div></>}
    </section><div className="rescue-results">
      <div aria-live="polite" aria-busy={state === "running"}>
        {runError && <div className="rescue-error" role="alert"><p>{runError}</p><p>Check the connection and run the search again. No replacement predictions are fabricated.</p></div>}
        {result ? result.candidates.length ? <><h2 className="rescue-results-title">Top 3 rescue candidates</h2><p>Removing {result.constraint.display_name} · {result.eligible_candidate_count} eligible candidates</p><div className="rescue-candidate-list">{result.candidates.slice(0,3).map(candidate => <Candidate key={candidate.formula_id} candidate={candidate} onValidate={setValidationId}/>)}</div>
          {result.candidates.length > 3 && <section className="rescue-pool"><h2>Additional candidates</h2><div className="trace-table-wrap"><table className="rescue-table"><thead><tr>{["Rank","Formula","Est. stability","Similarity","Changes","Score"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{result.candidates.slice(3).map(c => <tr key={c.formula_id}><td>#{c.rank}</td><td>{c.formula_id}</td><td>{percent(c.predicted_stability)}</td><td>{percent(c.formula_similarity)}</td><td>{c.number_of_changes}</td><td>{c.rescue_score.toFixed(3)}</td></tr>)}</tbody></table></div></section>}
          <p className="notice-note">Analysis results are retained in this browser session. Saved validation plans persist in Experimental Data. The rescue model does not evaluate sensory responses or guarantee laboratory success.</p>
        </> : <div className="empty-state"><h2>No candidate satisfies the constraint</h2><p>Try another formulation or ingredient. No recommendations are fabricated.</p></div>
        : state !== "error" && <div className="empty-state"><h2>{state === "running" ? "Evaluating candidate pool…" : "Choose a constraint, then run Formula Rescue."}</h2><p>Top 3 and additional ranked candidates appear after a successful engine response.</p></div>}
      </div></div></div>
  </section>;
}
