import { RESPONSES, type SensoryResponses, type OptimizationResult, type Candidate } from "../lib/reformulation-api";
export function displayNumber(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 6 });
}
export function ResponseTable({ baseline, candidate }: { baseline: SensoryResponses; candidate?: Candidate }) {
  return <div className="trace-table-wrap"><table className="rescue-table">
    <caption>Predicted responses — not physical laboratory results</caption>
    <thead><tr><th>Response / unit</th><th>Baseline</th>{candidate && <><th>Candidate</th><th>Δ</th></>}</tr></thead>
    <tbody>{RESPONSES.map(r => <tr key={r.key}><th scope="row">{r.name}<br/><small>{r.unit}</small></th>
      <td>{displayNumber(baseline[r.key])}</td>{candidate && <><td>{displayNumber(candidate.predicted_responses[r.key])}</td>
      <td>{candidate.predicted_response_delta[r.key] > 0 ? "+" : ""}{displayNumber(candidate.predicted_response_delta[r.key])}</td></>}</tr>)}</tbody>
  </table></div>;
}
export default function ReformulationResults({ result, onValidate }: { result: OptimizationResult; onValidate: (candidateId: string) => void }) {
  const p = result.process;
  return <>
    <h3>Target checks</h3><div className="trace-table-wrap"><table className="rescue-table">
      <thead><tr><th>Constraint</th><th>Threshold</th><th>Baseline</th><th>Sample pass count</th></tr></thead>
      <tbody>{Object.entries(result.target_constraints).map(([key, value]) => <tr key={key}><th scope="row">{key.replaceAll("_", " ")}</th>
        <td>{displayNumber(value!)}</td><td>{result.baseline.constraint_checks[key as keyof typeof result.target_constraints] ? "Pass" : "Not met"}</td>
        <td>{p.per_target_pass_count[key as keyof typeof result.target_constraints]?.toLocaleString("en-US") ?? "—"}</td></tr>)}</tbody>
    </table></div>
    <p className="small-note">Per-target sample pass counts are independent, not a sequential funnel.</p>
    <h3>Top {result.candidates.length} candidates</h3>
    {!result.candidates.length && <div className="empty-state" role="status"><h2>No feasible alternative found</h2>
      <p>No alternative was found in this search. Review targets, bounds or fixed factors. This does not prove global infeasibility; no substitute predictions are fabricated.</p></div>}
    <div className="rescue-candidate-list">{result.candidates.map(c => <article className="rescue-candidate" key={c.candidate_id}>
      <div className="rescue-card-head"><h3><span className="rank-number">#{c.rank}</span>Candidate {c.rank}</h3><span className="badge">PREDICTED FEASIBLE</span></div>
      <div className="trace-table-wrap"><table className="rescue-table"><caption>Composition factors (%); not a complete formulation</caption>
        <thead><tr><th>Ingredient</th><th>Baseline %</th><th>Candidate %</th><th>Δ percentage points</th></tr></thead>
        <tbody>{result.product.factors.map(f => <tr key={f.key}><th scope="row">{f.label}</th><td>{displayNumber(result.baseline.composition[f.key])}</td>
          <td>{displayNumber(c.composition[f.key])}</td><td>{c.composition_delta[f.key] > 0 ? "+" : ""}{displayNumber(c.composition_delta[f.key])}</td></tr>)}</tbody></table></div>
      <ResponseTable baseline={result.baseline.predicted_responses} candidate={c}/>
      <p className="small-note">Normalized change distance: {displayNumber(c.normalized_change_distance)}. Lower means less composition change, not confidence or probability of laboratory success.</p>
      <p className="small-note">Candidate ID: {c.candidate_id}</p>
      <button type="button" className="secondary candidate-lab-button" onClick={() => onValidate(c.candidate_id)} aria-label={"Open lab validation for Candidate " + c.rank}>Open Lab Validation <span aria-hidden="true">→</span></button>
    </article>)}</div>
    <p className="notice-note">Displayed values are rounded. Use full precision from Session Detail / JSON for lab plans; rounded compositions require new predictions and target checks.</p>
    <div className="scope-note"><strong>Evidence boundary</strong><p>Polynomial + Ridge learns synthetic profiles for each product/category, not original Paragon formulas or laboratory results. Safety, stability, efficacy, cost, sustainability and process parameters are not predicted.</p></div>
    <p className="small-note">Ranking: {p.ranking}. Diversity distance: {p.min_diversity_distance}.</p>
    <p className="disclaimer">{result.disclaimer}</p>
  </>;
}
