import { RESPONSES, type SensoryResponses, type OptimizationResult, type Candidate } from "../lib/reformulation-api";
export function displayNumber(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 6 });
}
export function ResponseTable({ baseline, candidate }: { baseline: SensoryResponses; candidate?: Candidate }) {
  return <div className="trace-table-wrap"><table className="rescue-table">
    <caption>Predicted responses — bukan hasil physical lab</caption>
    <thead><tr><th>Response / unit</th><th>Baseline</th>{candidate && <><th>Candidate</th><th>Δ</th></>}</tr></thead>
    <tbody>{RESPONSES.map(r => <tr key={r.key}><th scope="row">{r.name}<br/><small>{r.unit}</small></th>
      <td>{displayNumber(baseline[r.key])}</td>{candidate && <><td>{displayNumber(candidate.predicted_responses[r.key])}</td>
      <td>{candidate.predicted_response_delta[r.key] > 0 ? "+" : ""}{displayNumber(candidate.predicted_response_delta[r.key])}</td></>}</tr>)}</tbody>
  </table></div>;
}
export default function ReformulationResults({ result }: { result: OptimizationResult }) {
  const p = result.process;
  return <>
    <section className="rescue-process" aria-label="Ringkasan proses optimizer">
      <p className="eyebrow">REAL API RESPONSE / BATCH SEARCH</p><h2>What the engine did</h2>
      <div className="rescue-step-grid">{[
        ["01 / Sampled compositions", p.sampled_count, "Pencarian dalam batas bahan/fixed factors."],
        ["02 / Valid predictions", p.valid_output_count, "Output finite dan dalam batas respons model."],
        ["03 / Feasible alternatives", p.feasible_alternative_count, "Semua target lolos; formula baseline dikeluarkan."],
        ["04 / Returned candidates", p.returned_count, "Ranking perubahan minimum + keragaman kandidat."],
      ].map(([title, count, note]) => <div key={title}><h3>{title}</h3><strong>{Number(count).toLocaleString("id-ID")}</strong><p>{note}</p></div>)}</div>
      <p className="trace-note">Ringkasan setelah respons selesai, bukan streaming real-time. Seed: {p.seed}. Jumlah lolos per target bersifat independen, bukan funnel berurutan.</p>
    </section>
    <h3>Target checks</h3><div className="trace-table-wrap"><table className="rescue-table">
      <thead><tr><th>Constraint</th><th>Threshold</th><th>Baseline</th><th>Sample pass count</th></tr></thead>
      <tbody>{Object.entries(result.target_constraints).map(([key, value]) => <tr key={key}><th scope="row">{key.replaceAll("_", " ")}</th>
        <td>{displayNumber(value!)}</td><td>{result.baseline.constraint_checks[key as keyof typeof result.target_constraints] ? "Pass" : "Not met"}</td>
        <td>{p.per_target_pass_count[key as keyof typeof result.target_constraints]?.toLocaleString("id-ID") ?? "—"}</td></tr>)}</tbody>
    </table></div>
    <h3>Top {result.candidates.length} candidates</h3>
    {!result.candidates.length && <div className="empty-state" role="status"><h2>No feasible alternative found</h2>
      <p>Tidak ditemukan alternatif dalam pencarian ini. Periksa target, bounds, atau fixed factors. Ini bukan bukti bahwa seluruh ruang formulasi mustahil; tidak ada kandidat sintetis pengganti.</p></div>}
    <div className="rescue-candidate-list">{result.candidates.map(c => <article className="rescue-candidate" key={c.candidate_id}>
      <div className="rescue-card-head"><h3><span className="rank-number">#{c.rank}</span>Candidate {c.rank}</h3><span className="badge">PREDICTED FEASIBLE</span></div>
      <div className="trace-table-wrap"><table className="rescue-table"><caption>Composition factors (%); bukan formula lengkap</caption>
        <thead><tr><th>Ingredient</th><th>Baseline %</th><th>Candidate %</th><th>Δ percentage points</th></tr></thead>
        <tbody>{result.product.factors.map(f => <tr key={f.key}><th scope="row">{f.label}</th><td>{displayNumber(result.baseline.composition[f.key])}</td>
          <td>{displayNumber(c.composition[f.key])}</td><td>{c.composition_delta[f.key] > 0 ? "+" : ""}{displayNumber(c.composition_delta[f.key])}</td></tr>)}</tbody></table></div>
      <ResponseTable baseline={result.baseline.predicted_responses} candidate={c}/>
      <p className="small-note">Normalized change distance: {displayNumber(c.normalized_change_distance)}. Lebih kecil = perubahan komposisi lebih sedikit, bukan confidence atau probabilitas sukses lab.</p>
      <p className="small-note">Candidate ID: {c.candidate_id}</p>
    </article>)}</div>
    <p className="notice-note">Tampilan dibulatkan. Gunakan presisi asli dari Session detail / JSON untuk rencana lab; formula yang dibulatkan perlu prediksi dan pemeriksaan target ulang.</p>
    <div className="scope-note"><strong>Evidence boundary</strong><p>Polynomial + Ridge mempelajari data prototype sintetis per produk/kategori, bukan formula asli atau hasil lab Paragon. Safety, stability, efficacy, cost, sustainability dan parameter proses tidak diprediksi.</p></div>
    <p className="small-note">Ranking: {p.ranking}. Diversity distance: {p.min_diversity_distance}.</p>
    <p className="disclaimer">{result.disclaimer}</p>
  </>;
}
