"use client";
import { useEffect, useId, useRef, useState } from "react";
import { VALIDATION_TESTS, VALIDATION_EVENT, emptyLabDraft, validationIdentity, validationMetrics, makeValidationRecord,
  saveValidationRecord, evaluateMetric, validationExport, type ValidationContext, type ValidationRecord, type LabDraft } from "../lib/lab-validation";
import { useValidationLibrary } from "../lib/use-validation-library";
export function downloadValidation(record: ValidationRecord) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(validationExport(record), null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = "Spontan-validation-" + record.id + ".json";
  document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function number(value: number): string { return value.toLocaleString("en-US", { maximumFractionDigits: 4 }); }
function signed(value: number): string { return (value > 0 ? "+" : "") + number(value); }
export function ValidationSummary({ record }: { record: ValidationRecord }) {
  if (!record.submittedAt) return null;
  return <section className="validation-summary" aria-label="Validation Result Summary">
    <h3>Validation Result Summary</h3><p>AI Prediction vs Laboratory Result</p>
    <div className="trace-table-wrap"><table className="rescue-table"><thead><tr><th>Metric / unit</th><th>AI Prediction</th><th>Actual Lab Result</th><th>Difference</th></tr></thead>
      <tbody>{validationMetrics(record.context, record.draft.tests).map(metric => {
        const actual = record.draft.actual[metric.key] ?? ""; const diff = evaluateMetric(metric, actual, record.draft.comparable);
        return <tr key={metric.key}><th scope="row">{metric.label}<br/><small>{metric.unit}</small></th>
          <td>{metric.predicted === null ? metric.predictionNote ?? "Not predicted" : number(metric.predicted)}</td><td>{actual}</td>
          <td>{diff ? signed(diff.delta) + (diff.percent === null ? " (percentage undefined: zero prediction)" : " (" + signed(diff.percent) + "%)") :
            metric.predicted === null ? "Not comparable" : "Protocol / scale not confirmed"}</td></tr>;
      })}</tbody></table></div>
    <p className="small-note">Difference = actual − predicted; % uses predicted as reference. Differences are not model accuracy or proof of efficacy. No arbitrary pass threshold is applied.</p>
    {record.context.engine === "reformulation" && <p className="small-note">Predictions were learned from synthetic product profiles. Lab feedback is new experimental evidence, not verification of the synthetic training claims.</p>}
  </section>;
}
export default function CandidateValidation({ context, onOpenExperimental }: { context: ValidationContext; onOpenExperimental?: (recordId: string) => void }) {
  const { records, loading, error } = useValidationLibrary();
  if (loading) return <p role="status">Loading validation plan…</p>;
  if (error) return <p className="rescue-error" role="alert">{error}</p>;
  const previous = records.find(record => record.identity === validationIdentity(context));
  return <ValidationEditor key={validationIdentity(context)} context={context} previous={previous} onOpenExperimental={onOpenExperimental}/>;
}
function ValidationEditor({ context, previous, onOpenExperimental }: { context: ValidationContext; previous?: ValidationRecord; onOpenExperimental?: (recordId: string) => void }) {
  const [draft, setDraft] = useState<LabDraft>(() => previous?.draft ?? emptyLabDraft());
  const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const uid = useId();
  const metrics = validationMetrics(context, draft.tests);
  const completed = draft.status === "Completed" || draft.status === "Needs revision";
  const experimentInput = useRef<HTMLInputElement>(null);
  const focusExperiment = useRef(false);
  useEffect(() => {
    if (completed && focusExperiment.current) {
      focusExperiment.current = false;
      experimentInput.current?.focus();
      experimentInput.current?.scrollIntoView({ block: "center" });
    }
  }, [completed]);
  const unchanged = previous && JSON.stringify(previous.draft) === JSON.stringify(draft);
  function update<K extends keyof LabDraft>(key: K, value: LabDraft[K]) {
    setDraft(current => ({ ...current, [key]: value })); setMessage(""); setError("");
  }
  function save(submitting: boolean) {
    if (saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const next = submitting && draft.actual.stability_outcome === "FAIL" && draft.tests.includes("stability")
        ? { ...draft, status: "Needs revision" as const } : draft;
      const record = makeValidationRecord(context, next, previous, submitting);
      saveValidationRecord(record, localStorage); setDraft(record.draft);
      window.dispatchEvent(new Event(VALIDATION_EVENT));
      setMessage(submitting ? "✓ Validation result stored successfully. This experiment has been added to the experimental dataset library."
        : "✓ Validation plan saved as a draft. Return through Dataset Library → Experimental Data.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Validation could not be saved.");
    } finally { setSaving(false); }
  }
  return <section className="candidate-validation" aria-label={"Validation for " + context.title}>
    <div className="validation-heading"><h3>Validation Plan</h3><span className={"status-pill validation-status-" + draft.status.toLowerCase().replaceAll(" ", "-")}>{draft.status}</span></div>
    <ol className="validation-flow" aria-label="Candidate validation workflow">{["AI Prediction", "Validation Plan", "Lab Execution", "Actual Result", "Prediction Evaluation"].map(label => <li key={label}>{label}</li>)}</ol>
    <fieldset className="validation-tests" disabled={saving}><legend>Select Validation Tests</legend>
      {VALIDATION_TESTS.map(test => <label key={test.id}><input type="checkbox" checked={draft.tests.includes(test.id)}
        onChange={event => update("tests", event.target.checked ? [...draft.tests, test.id] : draft.tests.filter(id => id !== test.id))}/>{test.label}</label>)}
    </fieldset>
    <div className="lab-grid">
      <label htmlFor={uid + "-status"}>Validation Status<select id={uid + "-status"} value={draft.status}
        onChange={event => update("status", event.target.value as LabDraft["status"])}>
        <option value="Pending">Pending — Not Tested Yet</option><option value="Testing">Testing — Lab Execution</option>
        <option value="Completed">Completed — Testing Completed</option><option value="Needs revision">Failed / needs revision</option>
      </select></label>
      <label htmlFor={uid + "-experiment"}>Experiment ID{completed && " (required)"}<input ref={experimentInput} id={uid + "-experiment"} maxLength={80} value={draft.experimentId} onChange={e => update("experimentId", e.target.value)}/></label>
      <label className="lab-notes" htmlFor={uid + "-method"}>Test method / instrument{completed && " (required)"}<input id={uid + "-method"} maxLength={200} value={draft.method} onChange={e => update("method", e.target.value)}/></label>
      <label className="lab-notes" htmlFor={uid + "-notes"}>Lab notes<textarea id={uid + "-notes"} rows={2} maxLength={2000} value={draft.notes} onChange={e => update("notes", e.target.value)}/></label>
    </div>
    {!completed ? <div className="validation-waiting"><strong>Selected Tests</strong>
      <ul>{draft.tests.map(id => <li key={id}>✓ {VALIDATION_TESTS.find(test => test.id === id)?.label}</li>)}</ul>
      <p>{draft.status === "Testing" ? "Laboratory testing in progress…" : "Waiting for laboratory results…"}</p>
    </div> : <>
      <h3>Actual Laboratory Results</h3>
      {!metrics.length && <p>Select validation tests to display their result fields.</p>}
      {!!metrics.length && <div className="trace-table-wrap"><table className="rescue-table validation-input-table">
        <thead><tr><th>Metric / unit</th><th>AI Prediction</th><th>Actual Lab Result</th></tr></thead><tbody>{metrics.map(metric =>
          <tr key={metric.key}><th scope="row">{metric.label}<br/><small>{metric.unit}</small></th>
            <td>{metric.predicted === null ? metric.predictionNote ?? "Not predicted by this model" : number(metric.predicted)}</td>
            <td>{metric.kind === "outcome" ? <select aria-label={"Actual " + metric.label} value={draft.actual[metric.key] ?? ""}
              onChange={e => update("actual", { ...draft.actual, [metric.key]: e.target.value })}><option value="">Select result</option><option value="PASS">PASS</option><option value="FAIL">FAIL</option></select> :
              <input aria-label={"Actual " + metric.label} type={metric.kind === "number" ? "number" : "text"} step="any"
                min={metric.min} max={metric.max} maxLength={500} value={draft.actual[metric.key] ?? ""}
                onChange={e => update("actual", { ...draft.actual, [metric.key]: e.target.value })}/>}</td></tr>)}</tbody></table></div>}
      {metrics.some(metric => metric.predicted !== null) && <label className="checkbox-label validation-comparable"><input type="checkbox" checked={draft.comparable}
        onChange={e => update("comparable", e.target.checked)}/>Lab values use the same response scale, reference and measurement protocol as the displayed prediction.</label>}
    </>}
    <div className="validation-actions">
      <button className="secondary" type="button" disabled={saving} onClick={() => save(false)}>{completed ? "Save draft" : "Save Validation Plan"}</button>
      {!completed && <button className="primary" type="button" disabled={saving || !draft.tests.length}
        onClick={() => { focusExperiment.current = true; update("status", "Completed"); }}>Fill Experiment Data</button>}
      {completed && <button className="primary" type="button" disabled={saving} onClick={() => save(true)}>Save Validation Result</button>}
      {previous && <button className="mode-toggle" type="button" onClick={() => downloadValidation(previous)}>Download saved validation JSON</button>}
    </div>
    {!completed && <p className="small-note">After testing is finished, select Fill Experiment Data to open the actual-result fields. Use Validation Status to switch between Pending, Testing and Completed. Changes are drafts until saved; only Save Validation Result submits completed measurements.</p>}
    {onOpenExperimental && <div className="validation-library-link"><button type="button" className="mode-toggle" disabled={!previous || !unchanged || saving}
      onClick={() => { if(previous) onOpenExperimental(previous.id); }}>View Experimental Data <span aria-hidden="true">→</span></button>
      <p className="small-note">Save your plan or results first, then open the saved experiment to continue laboratory validation.</p></div>}
    {error && <p role="alert" className="rescue-error">{error}</p>}{message && <p role="status" className="validation-confirmation">{message}</p>}
    {unchanged && previous.submittedAt && completed && <ValidationSummary record={previous}/>}
    <p className="small-note">Stored on this browser/device only, not uploaded to the backend or synchronized across devices. This local library is not protected by the access form. Export JSON as a backup. Reviewed lab data may feed the monthly model improvement cycle; saving does not retrain either engine.</p>
  </section>;
}
