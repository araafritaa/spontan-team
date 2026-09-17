export const VALIDATION_TESTS = [
  { id: "stability", label: "Stability Test" },
  { id: "viscosity", label: "Viscosity / Rheology Test" },
  { id: "ph", label: "pH Test" },
  { id: "sensory", label: "Sensory Evaluation" },
  { id: "texture", label: "Texture / Spreadability Test" },
  { id: "hydration", label: "Hydration Measurement" },
  { id: "other", label: "Other Characterization" },
] as const;
export type TestId = typeof VALIDATION_TESTS[number]["id"];
export type ValidationStatus = "Pending" | "Testing" | "Completed" | "Needs revision";
export type ValidationContext = {
  engine: "reformulation" | "rescue";
  candidateId: string;
  title: string;
  modelVersion: string;
  dataOrigin: string;
  insight: string;
  predictions: Record<string, number>;
  composition: unknown;
  executedRequest: unknown;
};
export type LabDraft = {
  tests: TestId[];
  status: ValidationStatus;
  experimentId: string;
  method: string;
  notes: string;
  comparable: boolean;
  actual: Record<string, string>;
};
export type ValidationRecord = {
  schemaVersion: 1;
  id: string;
  identity: string;
  context: ValidationContext;
  draft: LabDraft;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
};
export type ValidationMetric = {
  key: string; label: string; unit: string; kind: "number" | "text" | "outcome";
  min?: number; max?: number; predicted: number | null; predictionNote?: string;
};
export const VALIDATION_STORAGE_KEY = "spontan.validation.v1";
export const VALIDATION_EVENT = "spontan-validation-change";
export function validationIdentity(context: ValidationContext): string {
  // Bind feedback to the exact execution, not just a reused formula/candidate ID.
  return JSON.stringify([context.engine, context.candidateId, context.modelVersion,
    context.dataOrigin, context.composition, context.executedRequest, context.insight]);
}
export function emptyLabDraft(): LabDraft {
  return { tests: [], status: "Pending", experimentId: "", method: "", notes: "", comparable: false, actual: {} };
}
export function validationMetrics(context: ValidationContext, tests: TestId[]): ValidationMetric[] {
  const predicted = (key: string) => context.engine === "reformulation" && Number.isFinite(context.predictions[key]) ? context.predictions[key] : null;
  const stability = context.predictions.predicted_stability;
  const metrics: Record<TestId, ValidationMetric[]> = {
    stability: [{ key: "stability_outcome", label: "Stability", unit: "PASS / FAIL", kind: "outcome", predicted: null,
      predictionNote: context.engine === "rescue" && Number.isFinite(stability)
        ? "Estimated stability " + (stability * 100).toFixed(1) + "%; not a predicted PASS/FAIL or measured score."
        : "Not predicted by this model" }],
    viscosity: [{ key: "viscosity_cp", label: "Viscosity", unit: "cP (record protocol / temperature)", kind: "number", min: 0, predicted: null }],
    ph: [{ key: "ph", label: "pH", unit: "pH", kind: "number", min: 0, max: 14, predicted: null }],
    sensory: [
      { key: "stickiness_score_0_10", label: "Stickiness", unit: "score 0–10", kind: "number", min: 0, max: 10, predicted: predicted("stickiness_score_0_10") },
      { key: "oiliness_score_0_10", label: "Oiliness", unit: "score 0–10", kind: "number", min: 0, max: 10, predicted: predicted("oiliness_score_0_10") },
    ],
    texture: [{ key: "texture_observation", label: "Texture / spreadability observation", unit: "protocol and observation", kind: "text", predicted: null,
      predictionNote: "Synthetic consistency index is not a viscosity or lab spreadability prediction." }],
    hydration: [{ key: "hydration_ratio", label: "Hydration", unit: "ratio to reference (same timepoint / method)", kind: "number", min: 0, predicted: predicted("hydration_ratio") }],
    other: [{ key: "other_characterization", label: "Other characterization", unit: "name, value, unit and protocol", kind: "text", predicted: null }],
  };
  return tests.flatMap(test => metrics[test]);
}
export function validateLabDraft(context: ValidationContext, draft: LabDraft, submitting: boolean): string {
  if (!draft.tests.length || draft.tests.some(id => !VALIDATION_TESTS.some(test => test.id === id)) ||
      new Set(draft.tests).size !== draft.tests.length) return "Select at least one validation test.";
  if (!["Pending", "Testing", "Completed", "Needs revision"].includes(draft.status)) return "Select a valid validation status.";
  if (draft.experimentId.length > 80 || draft.method.length > 200 || draft.notes.length > 2000) return "Lab metadata is too long.";
  if (Object.values(draft.actual).some(value => typeof value !== "string" || value.length > 500)) return "Lab result is too long.";
  if (!submitting) return "";
  if (draft.status !== "Completed" && draft.status !== "Needs revision") return "Mark testing completed before saving actual results.";
  if (!draft.experimentId.trim() || !draft.method.trim()) return "Enter experiment ID and test method / instrument.";
  for (const metric of validationMetrics(context, draft.tests)) {
    const value = (draft.actual[metric.key] ?? "").trim();
    if (!value) return "Enter the actual result for " + metric.label + ".";
    if (value.length > 500) return metric.label + " is too long.";
    if (metric.kind === "outcome" && value !== "PASS" && value !== "FAIL") return "Select PASS or FAIL for stability.";
    if (metric.kind === "number") {
      const number = Number(value);
      if (!Number.isFinite(number) || (metric.min !== undefined && number < metric.min) ||
          (metric.max !== undefined && number > metric.max)) return "Enter a valid value for " + metric.label + ".";
    }
  }
  return "";
}
export function evaluateMetric(metric: ValidationMetric, actual: string, comparable: boolean) {
  if (!comparable || metric.kind !== "number" || metric.predicted === null || !actual.trim() || !Number.isFinite(Number(actual))) return null;
  const delta = Number(actual) - metric.predicted;
  return { delta, percent: metric.predicted === 0 ? null : delta / metric.predicted * 100 };
}
export function makeValidationRecord(context: ValidationContext, draft: LabDraft, previous?: ValidationRecord,
  submitting = false, now = new Date().toISOString()): ValidationRecord {
  const message = validateLabDraft(context, draft, submitting);
  if (message) throw Error(message);
  if (previous && previous.identity !== validationIdentity(context)) throw Error("Validation belongs to a different engine execution.");
  const keys = validationMetrics(context, draft.tests).map(metric => metric.key);
  const clean = { ...draft, actual: Object.fromEntries(keys.filter(key => key in draft.actual).map(key => [key, draft.actual[key]])) };
  return { schemaVersion: 1, id: previous?.id ?? globalThis.crypto.randomUUID(), identity: validationIdentity(context),
    context, draft: clean, createdAt: previous?.createdAt ?? now, updatedAt: now, submittedAt: submitting ? now : null };
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function parseValidationRecords(raw: string | null): ValidationRecord[] {
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || value.length > 250) throw Error("Invalid validation library.");
  return value.map(item => {
    if (!object(item) || item.schemaVersion !== 1 || typeof item.id !== "string" ||
        typeof item.identity !== "string" || !object(item.context) || !object(item.draft)) throw Error("Invalid validation record.");
    const c = item.context; const d = item.draft;
    if ((c.engine !== "rescue" && c.engine !== "reformulation") ||
        !["candidateId", "title", "modelVersion", "dataOrigin", "insight"].every(key => typeof c[key] === "string") ||
        !object(c.predictions) || !Object.values(c.predictions).every(n => typeof n === "number" && Number.isFinite(n)) ||
        !Array.isArray(d.tests) || !["experimentId", "method", "notes", "status"].every(key => typeof d[key] === "string") ||
        typeof d.comparable !== "boolean" || !object(d.actual) || !Object.values(d.actual).every(v => typeof v === "string") ||
        typeof item.createdAt !== "string" || !Number.isFinite(Date.parse(item.createdAt)) ||
        typeof item.updatedAt !== "string" || !Number.isFinite(Date.parse(item.updatedAt)) ||
        !(item.submittedAt === null || typeof item.submittedAt === "string" && Number.isFinite(Date.parse(item.submittedAt)))) throw Error("Invalid validation record.");
    const record = item as unknown as ValidationRecord;
    if (record.identity !== validationIdentity(record.context) || validateLabDraft(record.context, record.draft, record.submittedAt !== null)) throw Error("Invalid validation record.");
    return record;
  });
}
export function saveValidationRecord(record: ValidationRecord, storage: Pick<Storage, "getItem" | "setItem">): ValidationRecord[] {
  // Write first; caller only shows success after durable browser storage accepts it.
  const records = parseValidationRecords(storage.getItem(VALIDATION_STORAGE_KEY));
  const next = [record, ...records.filter(item => item.identity !== record.identity)];
  if (next.length > 250) throw Error("Validation library is full. Export existing records before adding more.");
  storage.setItem(VALIDATION_STORAGE_KEY, JSON.stringify(next));
  return next;
}
export function validationExport(record: ValidationRecord) {
  return { ...record, storage_scope: "THIS_BROWSER_ONLY", training_ingestion: "NOT_UPLOADED",
    measured_results: record.submittedAt ? record.draft.actual : null,
    disclaimer: "Predicted / estimated and requires physical laboratory validation." };
}
