"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAllFormulas, reformulate, type FormulaSummary, type ReformulateResponse, type RescueCandidate } from "../lib/rescue-api";
const percent = (value: number) => (value * 100).toFixed(1) + "%";
type State = "idle" | "running" | "complete" | "error";
function Candidate({ candidate }: { candidate: RescueCandidate }) {
  return <article className="rescue-candidate">
    <div className="rescue-card-head"><h3><span className="rank-number">#{candidate.rank}</span> Formula {candidate.formula_id}</h3><span className="badge">{candidate.constraint_passed ? "CONSTRAINT PASS" : "CONSTRAINT FAIL"}</span></div>
    <div className="rescue-metrics"><div><span>Estimated stability</span><strong>{percent(candidate.predicted_stability)}</strong></div><div><span>Composition similarity</span><strong>{percent(candidate.formula_similarity)}</strong></div><div><span>Ingredients changed</span><strong>{candidate.number_of_changes}</strong></div></div>
    <p className="rescue-score">Rescue score: <strong>{candidate.rescue_score.toFixed(3)}</strong> · ranking score, bukan probabilitas keberhasilan lab.</p>
    <div className="trace-table-wrap"><table className="rescue-table"><caption>Perubahan komposisi · persen konsentrasi</caption><thead><tr><th scope="col">Ingredient</th><th scope="col">Original</th><th scope="col">Candidate</th></tr></thead><tbody>{candidate.changed_ingredients.map(change => <tr key={change.feature_name}><th scope="row">{change.display_name}</th><td>{change.original_pct.toFixed(2)}%</td><td>{change.candidate_pct.toFixed(2)}%</td></tr>)}</tbody></table></div>
  </article>;
}
export default function FormulaRescue() {
  const [formulas, setFormulas] = useState<FormulaSummary[]>([]);
  const [formulaId, setFormulaId] = useState<number | null>(null);
  const [ingredient, setIngredient] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [runError, setRunError] = useState("");
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<ReformulateResponse | null>(null);
  const [retry, setRetry] = useState(0);
  const activeRun = useRef<AbortController | null>(null);
  const formula = formulas.find(item => item.formula_id === formulaId);
  const reset = useCallback(() => { setResult(null); setRunError(""); setState("idle"); }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoadError(""); setFormulas([]); setFormulaId(null); setIngredient(""); reset();
    getAllFormulas(controller.signal).then(rows => {
      if (controller.signal.aborted) return;
      setFormulas(rows);
      const initial = rows.find(row => row.formula_id === 7) ?? rows[0];
      setFormulaId(initial?.formula_id ?? null);
      setIngredient(initial?.unavailable_ingredient_options[0]?.display_name ?? "");
    }).catch(error => { if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "Daftar formula gagal dimuat."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry, reset]);
  useEffect(() => () => { activeRun.current?.abort(); }, []);
  async function run() {
    if (!formula || !ingredient || activeRun.current) return;
    const controller = new AbortController(); activeRun.current = controller;
    setResult(null); setRunError(""); setState("running");
    try {
      const response = await reformulate(formula.formula_id, ingredient, controller.signal);
      if (!controller.signal.aborted) { setResult(response); setState("complete"); }
    } catch (error) {
      if (!controller.signal.aborted) { setRunError(error instanceof Error ? error.message : "Request gagal."); setState("error"); }
    } finally { if (activeRun.current === controller) activeRun.current = null; }
  }
  const steps = [
    ["Validate constraint", result ? (result.candidates.length ? (result.candidates.every(c => c.constraint_passed) ? "Constraint pass pada kandidat yang dikembalikan" : "Periksa constraint pada hasil") : "Tidak ada kandidat yang dikembalikan") : "Bahan tidak tersedia harus menjadi 0%"],
    ["Search history", result ? result.eligible_candidate_count + " kandidat eligible" : "Cari formula historis observed-stable"],
    ["Estimate stability", result ? "Estimasi model diterima dari backend" : "XGBoost menghitung estimasi stabilitas"],
    ["Rank minimal change", result ? result.candidates.length + " kandidat diranking dan dikembalikan" : "Stability + similarity + minimal changes"],
  ];
  return <section className="rescue-feature">
    <p className="eyebrow">HISTORICAL FORMULA SEARCH</p><h1>Recover the formula.<br/><span>Preserve what works.</span></h1>
    <p>Formula shampoo yang sudah berhasil + satu bahan unavailable → kandidat historis untuk pengujian lab.</p>
    <span className="badge">{loading ? "MEMUAT DATA API" : loadError ? "API BELUM TERSEDIA" : formulas.length ? "DATA FROM API / NO MOCK FALLBACK" : "API / DAFTAR KOSONG"}</span>
    <div className="rescue-layout"><section className="rescue-setup"><h2>Define the constraint</h2>
      <label htmlFor="rescue-formula">Formula awal</label><select id="rescue-formula" value={formulaId ?? ""} disabled={loading || state === "running" || !formulas.length} onChange={event => { const next = formulas.find(row => row.formula_id === Number(event.target.value)); setFormulaId(next?.formula_id ?? null); setIngredient(next?.unavailable_ingredient_options[0]?.display_name ?? ""); reset(); }}>
        {loading ? <option value="">Memuat formula…</option> : !formulas.length ? <option value="">Tidak ada formula tersedia</option> : formulas.map(row => <option key={row.formula_id} value={row.formula_id}>Formula {row.formula_id}</option>)}
      </select>
      <label htmlFor="rescue-ingredient">Ingredient unavailable</label><select id="rescue-ingredient" value={ingredient} disabled={loading || state === "running" || !formula} onChange={event => { setIngredient(event.target.value); reset(); }}>
        {!formula?.unavailable_ingredient_options.length && <option value="">Pilih formula dahulu</option>}
        {formula?.unavailable_ingredient_options.map(item => <option key={item.feature_name} value={item.display_name}>{item.display_name}</option>)}
      </select>
      <button className="primary" disabled={loading || state === "running" || !formula || !ingredient} onClick={() => void run()}>{state === "running" ? "Memproses…" : "Run Formula Rescue"} →</button>
      {loadError && <div role="alert" className="rescue-error"><p>{loadError}</p><button className="back" onClick={() => setRetry(retry + 1)}>Retry daftar formula</button></div>}
      {!loading && !loadError && !formulas.length && <p>Tidak ada formula stable yang dapat dipilih.</p>}
      {formula && <><h3>Original composition <span className="badge">OBSERVED STABLE</span></h3><p>Formula {formula.formula_id}</p><div className="trace-table-wrap"><table className="rescue-table"><thead><tr><th scope="col">Ingredient</th><th scope="col">%</th></tr></thead><tbody>{formula.ingredients.map(item => <tr key={item.feature_name}><th scope="row">{item.display_name}</th><td>{item.concentration_pct.toFixed(2)}</td></tr>)}</tbody></table></div></>}
    </section><div className="rescue-results"><section className="rescue-process" aria-live="polite"><p className="eyebrow">RESCUE PROCESS TRACE</p><h2>{state === "running" ? "Backend sedang memproses…" : state === "complete" ? "Hasil API diterima" : state === "error" ? "Request belum berhasil" : "Siap menjalankan rescue"}</h2><div className="rescue-step-grid">{steps.map(([title, detail], index) => <div key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{detail}</p></div>)}</div><p className="trace-note">Bukan progress per langkah secara real-time. Ringkasan diperbarui setelah respons backend diterima.</p></section>
      <div aria-live="polite" aria-busy={state === "running"}>
        {runError && <div className="rescue-error" role="alert"><p>{runError}</p><p>Periksa koneksi, lalu jalankan ulang. Tidak ada hasil mock pengganti.</p></div>}
        {result ? result.candidates.length ? <><h2 className="rescue-results-title">Top 3 rescue candidates</h2><p>Removing {result.constraint.display_name} · {result.eligible_candidate_count} eligible candidates</p><div className="rescue-candidate-list">{result.candidates.slice(0,3).map(candidate => <Candidate key={candidate.formula_id} candidate={candidate}/>)}</div>
          {result.candidates.length > 3 && <section className="rescue-pool"><h2>Kandidat berikutnya</h2><div className="trace-table-wrap"><table className="rescue-table"><thead><tr>{["Rank","Formula","Est. stability","Similarity","Changes","Score"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{result.candidates.slice(3).map(c => <tr key={c.formula_id}><td>#{c.rank}</td><td>{c.formula_id}</td><td>{percent(c.predicted_stability)}</td><td>{percent(c.formula_similarity)}</td><td>{c.number_of_changes}</td><td>{c.rescue_score.toFixed(3)}</td></tr>)}</tbody></table></div></section>}
          <p className="demo-note">Hasil API nyata, belum disimpan ke Dataset Library. Model tidak mengevaluasi sensory atau menjamin keberhasilan lab.</p>
        </> : <div className="empty-state"><h2>Tidak ada kandidat yang memenuhi batas</h2><p>Coba formula atau bahan lain. Tidak ada rekomendasi yang dibuat-buat.</p></div>
        : state !== "error" && <div className="empty-state"><h2>{state === "running" ? "Evaluating candidate pool…" : "Pilih constraint, lalu jalankan rescue."}</h2><p>Top 3 dan peringkat berikutnya muncul setelah respons API berhasil.</p></div>}
      </div></div></div>
  </section>;
}
