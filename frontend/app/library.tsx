"use client";
import { useState } from "react";

const tabs = ["Clear Insight", "Formula Rescue", "AI Reformulation"] as const;
type Category = typeof tabs[number];
type Metric = { name: string; baseline: number | null; candidate: number | null; unit: string; note: string };
type Session = { id: string; category: Category; date: string; title: string; summary: string; input: Record<string, unknown>; metrics: Metric[] };

const sessions: Session[] = tabs.flatMap((category, group) => [0, 1].map(index => ({
  id: `DEMO-${group}-${index + 1}`, category,
  date: index ? "2026-09-17T04:30:00Z" : "2026-09-15T03:00:00Z",
  title: category === "Clear Insight" ? (index ? "Sensory feedback — Emulsion" : "Hydration feedback — Emulsion") : category === "Formula Rescue" ? `Shampoo rescue — Demo ${index + 1}` : `Sensory optimization — Demo ${index + 1}`,
  summary: category === "Formula Rescue" ? "Contoh riwayat pencarian formula ketika bahan tidak tersedia." : index ? "Keluhan after-feel lengket; target perlu dikonfirmasi R&D." : "Keluhan kurang melembapkan; target perbaikan hydration.",
  input: category === "Formula Rescue" ? { formula_id: "DEMO-F01", unavailable_ingredient: "Ingredient demo A" } : { clean_insight: index ? "After-feel terlalu lengket" : "Produk kurang melembapkan", product_system: "Emulsion demo" },
  metrics: category === "Clear Insight" ? [
    { name: "Hydration", baseline: null, candidate: null, unit: "Belum diukur", note: "Target: tingkatkan; perlu konfirmasi R&D" },
    { name: "Stickiness", baseline: null, candidate: null, unit: "Belum diukur", note: index ? "Target: kurangi" : "Pantau trade-off" },
    { name: "Oiliness", baseline: null, candidate: null, unit: "Belum diukur", note: "Pantau trade-off" },
  ] : category === "Formula Rescue" ? [
    { name: "Stability estimate", baseline: 80, candidate: index ? 83 : 88, unit: "% · angka dummy", note: "Ilustrasi tampilan; bukan inferensi model" },
    { name: "Composition similarity", baseline: null, candidate: index ? 75 : 69, unit: "% · angka dummy", note: "Kemiripan komposisi, bukan atribut sensory" },
    { name: "Sensory properties", baseline: null, candidate: null, unit: "Tidak tersedia", note: "Model rescue tidak memprediksi sensory" },
  ] : [
    { name: "Hydration", baseline: 1.2, candidate: index ? 1.4 : 1.6, unit: "Unit demo", note: "Angka dummy, bukan skala publikasi" },
    { name: "Stickiness", baseline: 3.1, candidate: index ? 2.4 : 2.8, unit: "Unit demo", note: "Angka dummy, bukan output model" },
    { name: "Oiliness", baseline: 2.6, candidate: index ? 2.5 : 2.7, unit: "Unit demo", note: "Angka dummy, bukan output model" },
    { name: "Consistency", baseline: null, candidate: null, unit: "Belum tersedia", note: "Tidak dievaluasi" },
  ],
})));

function format(date: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(date));
}
function payload(row: Session) {
  return { demo: true, session_id: row.id, timestamp_utc: row.date, category: row.category, input: row.input, output: { metrics: row.metrics, evidence_type: "UI_FIXTURE_ONLY", model_executed: false }, disclaimer: "Predicted / estimated and requires physical laboratory validation." };
}
function download(row: Session, type: "csv" | "json") {
  const cell = (value: unknown) => {
    const text = String(value ?? "");
    const safe = /^[=+@\-\t\r]/.test(text) ? "'" + text : text;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  const csv = [
    ["session_id", "timestamp_utc", "demo", "attribute", "baseline", "candidate", "unit", "note", "disclaimer"],
    ...row.metrics.map(metric => [row.id, row.date, true, metric.name, metric.baseline, metric.candidate, metric.unit, metric.note, payload(row).disclaimer]),
  ].map(line => line.map(cell).join(",")).join("\r\n");
  const text = type === "json" ? JSON.stringify(payload(row), null, 2) : "\uFEFF" + csv;
  const url = URL.createObjectURL(new Blob([text], { type: type === "json" ? "application/json" : "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = row.id + "-DEMO." + type;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Preview({ row }: { row: Session }) {
  const metrics = row.metrics.filter(item => item.candidate !== null);
  if (!metrics.length) return <div className="insight-preview"><p className="eyebrow">TECHNICAL TARGETS / DEMO</p>{row.metrics.map(item => <div key={item.name}><strong>{item.name}</strong><span>{item.note}</span></div>)}</div>;
  return <div className="metric-preview"><div className="chart-legend"><span>● Baseline dummy</span><span>● Candidate dummy</span></div>{metrics.map(item => {
    const max = Math.max(item.baseline ?? 0, item.candidate ?? 0, 1);
    return <div className="metric-row" key={item.name}><span>{item.name}</span><div><div className="metric-bar baseline" style={{ width: `${(item.baseline ?? 0) / max * 100}%` }} /><div className="metric-bar candidate" style={{ width: `${(item.candidate ?? 0) / max * 100}%` }} /></div><span>{item.candidate}</span></div>;
  })}<p>Perbandingan hanya dalam atribut yang sama, bukan antarunit.<br />Angka dummy; bukan hasil model atau lab.</p></div>;
}

export default function Library({ onUseInsight }: { onUseInsight?: (text: string) => void }) {
  const [tab, setTab] = useState<Category>("Clear Insight");
  const [order, setOrder] = useState("new");
  const [selected, setSelected] = useState<string | null>(null);
  const [raw, setRaw] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const rows = sessions.filter(row => row.category === tab).sort((a, b) => (order === "new" ? -1 : 1) * (Date.parse(a.date) - Date.parse(b.date)));
  const detail = rows.find(row => row.id === selected);
  function open(row: Session) { setSelected(row.id); setRaw(false); setMenu(null); }
  return <section className="library">
    <p className="eyebrow">WORKSPACE KNOWLEDGE</p><h1>Dataset Library</h1><p>Jelajahi insight, hasil rescue, dan eksperimen reformulation.</p>
    <p className="demo-note"><strong>DATA DEMO</strong> — Angka dan sesi hanya fixture desain. Tidak ada model/lab yang dijalankan atau riwayat backend yang dimuat.</p>
    <div className="library-tabs" aria-label="Kategori library">{tabs.map(item => <button key={item} aria-pressed={tab === item} onClick={() => { setTab(item); setSelected(null); setRaw(false); setMenu(null); }}>{item}</button>)}</div>
    <div className="library-toolbar"><label>Sort by date <select value={order} onChange={event => setOrder(event.target.value)}><option value="new">Terbaru dahulu</option><option value="old">Terlama dahulu</option></select></label><span className="badge">{rows.length} SESI DEMO</span></div>
    {detail ? <section className="sensory-detail">
      <button className="back" onClick={() => { setSelected(null); setRaw(false); }}>← Kembali ke library</button>
      <div className="detail-heading"><div><span className="badge">DATA DEMO</span><h2>{detail.title}</h2><time dateTime={detail.date}>{format(detail.date)} WIB</time></div><button className="mode-toggle" onClick={() => download(detail, raw ? "json" : "csv")}>Download {raw ? "session JSON" : "results CSV"}</button></div>
      <p>{detail.summary}</p>
      {tab === "Clear Insight" && onUseInsight && <button className="mode-toggle" onClick={() => onUseInsight(String(detail.input.clean_insight ?? ""))}>Gunakan insight demo di AI Reformulation →</button>}
      <div className="library-tabs"><button aria-pressed={!raw} onClick={() => setRaw(false)}>Simple Mode</button><button aria-pressed={raw} onClick={() => setRaw(true)}>Session Detail</button></div>
      {raw ? <div className="raw-detail"><h3>Session Detail / sanitized demo JSON</h3><p className="raw-note">Bukan kontrol izin akses. Jangan tampilkan token, password, atau data rahasia pada demo publik.</p><pre>{JSON.stringify(payload(detail), null, 2)}</pre></div> : <div className="trace-table-wrap"><table className="trace-table sensory-table"><caption>{tab === "Formula Rescue" ? "Ringkasan rescue — sensory tidak didukung" : tab === "Clear Insight" ? "Target sensory dari clean insight — belum ada pengukuran" : "Detail sensory — baseline vs candidate dummy"}</caption><thead><tr><th scope="col">Attribute</th><th scope="col">Baseline</th><th scope="col">Candidate</th><th scope="col">Unit</th><th scope="col">Catatan</th></tr></thead><tbody>{detail.metrics.map(item => <tr key={item.name}><th scope="row">{item.name}</th><td>{item.baseline ?? "—"}</td><td>{item.candidate ?? "—"}</td><td>{item.unit}</td><td>{item.note}</td></tr>)}</tbody></table></div>}
    </section> : <div className="session-grid">{rows.map(row => <article className="session-card result-card" key={row.id}>
      <div className="result-card-heading"><h2><button className="card-title" onClick={() => open(row)}>{row.title}</button></h2><div className="download-menu" onKeyDown={event => { if (event.key === "Escape") { setMenu(null); (event.currentTarget.querySelector("button") as HTMLButtonElement)?.focus(); } }}>
        <button className="ellipsis" aria-label={`Download menu: ${row.title}`} aria-expanded={menu === row.id} aria-controls={`download-${row.id}`} onClick={() => setMenu(menu === row.id ? null : row.id)}>⋯</button>
        {menu === row.id && <div id={`download-${row.id}`} className="download-popover"><button onClick={() => { download(row, "csv"); setMenu(null); }}>↓ Download results (CSV)</button><button onClick={() => { download(row, "json"); setMenu(null); }}>↓ Download session (JSON)</button></div>}
      </div></div>
      <time dateTime={row.date}>{format(row.date)} WIB</time><p>{row.summary}</p><Preview row={row} /><span className="badge">DATA DEMO / {row.id}</span>
    </article>)}</div>}
  </section>;
}
