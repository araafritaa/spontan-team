"use client";

import { useMemo, useState } from "react";
import type { SessionAnalysis } from "../lib/session-analysis";

type Tab = "Clear Insight" | "Formula Rescue" | "AI Reformulations";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function download(row: SessionAnalysis, raw: boolean) {
  const safe = row.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) || "analysis";
  const content = raw
    ? JSON.stringify(row, null, 2)
    : `field,value\ntitle,${JSON.stringify(row.title)}\ntype,${row.kind}\nstatus,${row.status}\ncreated_at,${row.createdAt}\ninsight,${JSON.stringify(row.insight)}\nsummary,${JSON.stringify(row.summary)}\n`;
  const url = URL.createObjectURL(new Blob([content], { type: raw ? "application/json" : "text/csv" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safe}.${raw ? "json" : "csv"}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Library({ analyses, onUseInsight }: { analyses: SessionAnalysis[]; onUseInsight?: (text: string) => void }) {
  const [tab, setTab] = useState<Tab>("Clear Insight");
  const [order, setOrder] = useState<"new" | "old">("new");
  const [detailId, setDetailId] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const rows = useMemo(() => analyses.filter(item => tab === "Formula Rescue" ? item.kind === "rescue" : item.kind === "reformulation" && (tab !== "Clear Insight" || Boolean(item.insight.trim()))).sort((a, b) => (order === "new" ? -1 : 1) * a.createdAt.localeCompare(b.createdAt)), [analyses, order, tab]);
  const detail = rows.find(item => item.id === detailId);

  return <section className="library-feature">
    <p className="eyebrow">SESSION DATASET LIBRARY</p><h1>From analysis to<br /><span>traceable evidence.</span></h1><p>Data pada halaman ini hanya berasal dari API run yang berhasil selama sesi browser saat ini.</p>
    <div className="library-tabs" role="tablist" aria-label="Dataset category">{(["Clear Insight", "Formula Rescue", "AI Reformulations"] as Tab[]).map(item => <button role="tab" aria-selected={tab === item} aria-pressed={tab === item} key={item} onClick={() => { setTab(item); setDetailId(""); setAdvanced(false); }}>{item}</button>)}</div>
    <div className="library-toolbar"><label>Sort by date <select value={order} onChange={event => setOrder(event.target.value as "new" | "old")}><option value="new">Newest first</option><option value="old">Oldest first</option></select></label><span className="badge">{rows.length} SESSION RECORD{rows.length === 1 ? "" : "S"}</span></div>
    {!detail ? rows.length ? <div className="session-grid">{rows.map(row => <article className="session-card" key={row.id}><span className="badge">{row.kind === "rescue" ? "FORMULA RESCUE" : tab.toUpperCase()}</span><button className="session-title" onClick={() => setDetailId(row.id)}><h2>{tab === "Clear Insight" ? row.insight : row.title}</h2></button><time dateTime={row.createdAt}>{formatDate(row.createdAt)}</time><p>{row.summary}</p><div className="session-card-footer"><span className="status-pill status-complete">{row.status}</span><button className="mode-toggle" onClick={() => download(row, false)}>Download results</button></div></article>)}</div> : <div className="empty-state"><h2>No session data yet</h2><p>Run {tab === "Formula Rescue" ? "Formula Rescue" : "a reformulation analysis"} successfully. Its real response will then appear here.</p></div>
    : <section className="library-detail"><button className="back" onClick={() => { setDetailId(""); setAdvanced(false); }}>← Back to library</button><div className="detail-heading"><div><span className="badge">{detail.kind === "rescue" ? "FORMULA RESCUE" : "AI REFORMULATION"}</span><h2>{detail.title}</h2><time dateTime={detail.createdAt}>{formatDate(detail.createdAt)}</time></div><button className="mode-toggle" onClick={() => download(detail, advanced)}>Download {advanced ? "session JSON" : "results CSV"}</button></div>
      <div className="simple-detail"><dl className="review-list"><dt>Status</dt><dd>{detail.status}</dd><dt>Insight / goal</dt><dd>{detail.insight || "No contextual insight was entered."}</dd><dt>Summary</dt><dd>{detail.summary}</dd></dl>{tab === "Clear Insight" && onUseInsight && <button className="secondary" onClick={() => onUseInsight(detail.insight)}>Use this insight in New Analysis →</button>}</div>
      <button className="mode-toggle advanced-toggle" onClick={() => setAdvanced(value => !value)}>{advanced ? "Hide Session Detail" : "Open Session Detail"}</button>
      {advanced && <div className="raw-detail"><h3>Session Detail / sanitized JSON</h3><p className="raw-note">This view contains the executed inputs and API response captured in this browser session. It is not an access-control layer.</p><pre>{JSON.stringify(detail.payload, null, 2)}</pre></div>}
    </section>}
  </section>;
}
