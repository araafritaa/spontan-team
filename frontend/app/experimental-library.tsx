"use client";
import { useState } from "react";
import CandidateValidation, { downloadValidation } from "./candidate-validation";
import { validationExport, type ValidationRecord } from "../lib/lab-validation";
export default function ExperimentalLibrary({ records, loading, error, order, initialRecordId = "" }: {
  records: ValidationRecord[]; loading: boolean; error: string; order: "new" | "old"; initialRecordId?: string;
}) {
  const [selectedId, setSelectedId] = useState(initialRecordId); const [advanced, setAdvanced] = useState(false);
  const sorted = [...records].sort((a, b) => (order === "new" ? -1 : 1) * a.updatedAt.localeCompare(b.updatedAt));
  const selected = records.find(record => record.id === selectedId);
  if (loading) return <p role="status">Loading experimental library…</p>;
  if (error) return <p className="rescue-error" role="alert">{error}</p>;
  if (selected) return <section className="library-detail">
    <button type="button" className="back" onClick={() => { setSelectedId(""); setAdvanced(false); }}>← Back to experimental library</button>
    <div className="detail-heading"><div><span className="badge">{selected.context.engine === "rescue" ? "FORMULA RESCUE" : "AI REFORMULATION"}</span><h2>{selected.context.title}</h2>
      <p className="small-note">Model: {selected.context.modelVersion} · Candidate ID: {selected.context.candidateId}</p></div></div>
    <CandidateValidation context={selected.context}/>
    <button className="mode-toggle advanced-toggle" type="button" onClick={() => setAdvanced(value => !value)}>{advanced ? "Hide Session Detail" : "Open Session Detail"}</button>
    {advanced && <div className="raw-detail"><h3>Validation session / execution snapshot</h3><pre>{JSON.stringify(validationExport(selected), null, 2)}</pre></div>}
  </section>;
  return <>
    <p className="notice-note">Saved validation plans and lab results on this browser/device. Drafts are not measured data. Submitted experiments remain separate from training until reviewed in the planned monthly improvement cycle. No automatic training job runs when saving.</p>
    {sorted.length ? <div className="session-grid">{sorted.map(record => <article className="session-card" key={record.id}>
      <span className="badge">{record.context.engine === "rescue" ? "FORMULA RESCUE" : "AI REFORMULATION"}</span>
      <button className="session-title" type="button" onClick={() => setSelectedId(record.id)}><h2>{record.context.title}</h2></button>
      <time dateTime={record.updatedAt}>{new Date(record.updatedAt).toLocaleString("en-GB")}</time>
      <p>{record.draft.tests.length} selected tests · {record.submittedAt ? "Actual results saved" : "Plan / draft — no submitted results"}</p>
      <div className="session-card-footer"><span className={"status-pill validation-status-" + record.draft.status.toLowerCase().replaceAll(" ", "-")}>{record.draft.status}</span>
        <button className="mode-toggle" type="button" onClick={() => downloadValidation(record)}>Download validation JSON</button></div>
    </article>)}</div> : <div className="empty-state"><h2>No saved validation plans yet</h2><p>Choose validation tests on a candidate card and save its plan. Return here to enter laboratory results later.</p></div>}
  </>;
}
