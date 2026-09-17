import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";
import { test } from "node:test";
const source = readFileSync(new URL("../lib/lab-validation.ts", import.meta.url), "utf8");
const code = stripTypeScriptTypes(source).replace(/^export /gm, "");
const v = {};
vm.runInNewContext(code + "\nObject.assign(exports,{VALIDATION_TESTS,VALIDATION_STORAGE_KEY,validationIdentity,emptyLabDraft,validationMetrics,validateLabDraft,evaluateMetric,makeValidationRecord,parseValidationRecords,saveValidationRecord,validationExport});",
  { exports: v, crypto: globalThis.crypto });
function context(engine = "reformulation") {
  return { engine, candidateId: "candidate-1", title: "Unit fixture", modelVersion: "test-v1",
    dataOrigin: "SYNTHETIC_PROTOTYPE_DATA", insight: "Unit insight", composition: { a: 3 },
    executedRequest: { product_id: "unit", target: 1.6 }, predictions: {
      hydration_ratio: 1.62, stickiness_score_0_10: 3.2, oiliness_score_0_10: 2.5, predicted_stability: .88,
    } };
}
function draft() { return { ...v.emptyLabDraft(), tests: ["hydration", "viscosity"], status: "Completed",
  experimentId: "EXP-1", method: "Matched protocol", comparable: true,
  actual: { hydration_ratio: "1.58", viscosity_cp: "5100" } }; }
function storage(initial = null) {
  let raw = initial;
  return { getItem: () => raw, setItem: (key, value) => { assert.equal(key, v.VALIDATION_STORAGE_KEY); raw = value; } };
}
test("all seven test types dynamically produce only selected metrics", () => {
  assert.equal(v.VALIDATION_TESTS.length, 7);
  const metrics = v.validationMetrics(context(), ["hydration", "ph"]);
  assert.deepEqual(Array.from(metrics, m => m.key), ["hydration_ratio", "ph"]);
  assert.equal(metrics[0].predicted, 1.62); assert.equal(metrics[1].predicted, null);
});
test("rescue probability is not converted to PASS or compared to measured hydration", () => {
  const metrics = v.validationMetrics(context("rescue"), ["stability", "hydration", "viscosity"]);
  assert(metrics.every(m => m.predicted === null));
  assert.match(metrics[0].predictionNote, /88.0%/);
  assert.equal(v.evaluateMetric(metrics[0], "PASS", true), null);
});
test("pending plans persist, reload with execution snapshot and have no measured results", () => {
  const lab = { ...v.emptyLabDraft(), tests: ["stability", "sensory"] };
  const r = v.makeValidationRecord(context(), lab);
  const s = storage(); v.saveValidationRecord(r, s);
  const restored = v.parseValidationRecords(s.getItem());
  assert.equal(restored.length, 1); assert.equal(restored[0].draft.status, "Pending");
  assert.equal(v.validationExport(restored[0]).measured_results, null);
  assert.equal(v.validationExport(restored[0]).training_ingestion, "NOT_UPLOADED");
  assert.equal(restored[0].context.modelVersion, "test-v1");
});
test("completion requires metadata and every selected actual result; rejects invalid ranges/nonfinite", () => {
  assert.equal(v.validateLabDraft(context(), draft(), true), "");
  for (const mutate of [d => d.experimentId = "", d => d.method = "", d => d.actual.hydration_ratio = "",
    d => d.actual.hydration_ratio = "Infinity", d => d.actual.viscosity_cp = "-1",
    d => { d.tests = ["ph"]; d.actual.ph = "15"; }, d => { d.tests = ["sensory"]; d.actual.stickiness_score_0_10 = "11"; },
    d => { d.tests = ["stability"]; d.actual.stability_outcome = "pending"; },
    d => d.status = "Pending", d => d.tests = [], d => d.tests = ["hydration", "hydration"]]) {
    const d = draft(); mutate(d); assert.notEqual(v.validateLabDraft(context(), d, true), "");
    assert.throws(() => v.makeValidationRecord(context(), d, undefined, true));
  }
});
test("summary needs protocol confirmation; percent is signed relative error, zero remains undefined", () => {
  const m = v.validationMetrics(context(), ["hydration"])[0];
  assert.equal(v.evaluateMetric(m, "1.58", false), null);
  const result = v.evaluateMetric(m, "1.58", true);
  assert(Math.abs(result.delta + .04) < 1e-12); assert(Math.abs(result.percent + 2.469135802469) < 1e-9);
  assert.equal(v.evaluateMetric({ ...m, predicted: 0 }, "1", true).percent, null);
});
test("plans/results upsert per exact execution; different candidates, engines, versions and targets stay separate", () => {
  const s = storage(); const c = context();
  const pending = v.makeValidationRecord(c, { ...v.emptyLabDraft(), tests: ["hydration"] });
  v.saveValidationRecord(pending, s);
  const completed = v.makeValidationRecord(c, draft(), pending, true);
  assert.equal(completed.id, pending.id); assert(completed.submittedAt);
  assert.equal(v.saveValidationRecord(completed, s).length, 1);
  for (const changed of [{ ...c, candidateId: "candidate-2" }, { ...c, engine: "rescue" },
    { ...c, modelVersion: "test-v2" }, { ...c, executedRequest: { target: 2 } },
    { ...c, composition: { a: 4 } }]) {
    assert.notEqual(v.validationIdentity(changed), v.validationIdentity(c));
    assert.throws(() => v.makeValidationRecord(changed, draft(), completed));
    v.saveValidationRecord(v.makeValidationRecord(changed, { ...v.emptyLabDraft(), tests: ["stability"] }), s);
  }
  assert.equal(v.parseValidationRecords(s.getItem()).length, 6);
});
test("unselected metric values are dropped; saving a draft invalidates submitted comparisons", () => {
  const d = draft(); d.actual.ph = "7";
  const complete = v.makeValidationRecord(context(), d, undefined, true);
  assert.equal(complete.draft.actual.ph, undefined);
  const changed = v.makeValidationRecord(context(), { ...complete.draft, status: "Pending" }, complete);
  assert.equal(changed.submittedAt, null); assert.equal(v.validationExport(changed).measured_results, null);
});
test("storage quota/blocked errors surface and damaged library is never overwritten", () => {
  const r = v.makeValidationRecord(context(), draft(), undefined, true);
  assert.throws(() => v.saveValidationRecord(r, { getItem: () => null, setItem: () => { throw Error("Quota"); } }), /Quota/);
  let writes = 0;
  assert.throws(() => v.saveValidationRecord(r, { getItem: () => "{damaged", setItem: () => { writes++; } }));
  assert.equal(writes, 0);
  assert.throws(() => v.parseValidationRecords(JSON.stringify([{ ...r, identity: "wrong" }])));
  assert.throws(() => v.parseValidationRecords(JSON.stringify([{ ...r, draft: { ...r.draft, status: "invented" } }])));
});
test("failed lab tests remain actual FAIL observations with no fabricated model comparison", () => {
  const d = { ...draft(), tests: ["stability"], status: "Needs revision", actual: { stability_outcome: "FAIL" } };
  const r = v.makeValidationRecord(context("rescue"), d, undefined, true);
  assert.equal(r.draft.status, "Needs revision"); assert.equal(v.validationExport(r).measured_results.stability_outcome, "FAIL");
});
