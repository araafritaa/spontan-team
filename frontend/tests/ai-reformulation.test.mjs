import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";
import { test } from "node:test";
function moduleAt(path, names, globals = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const code = stripTypeScriptTypes(source).replace(/^import .*$/gm, "").replace(/^export /gm, "");
  const exports = {};
  vm.runInNewContext(code + `\nObject.assign(exports, { ${names} });`, { exports, URL, Response, AbortSignal, TextDecoder, ...globals });
  return exports;
}
function api(fetch = () => { throw Error("Unexpected fetch"); }) {
  return moduleAt("../lib/reformulation-api.ts", "FACTORS, AI_DISCLAIMER, validateOptimization, fetchProductCatalog, predictComposition, optimizeComposition", { fetch });
}
const a = api();
const draft = moduleAt("../lib/reformulation-draft.ts", "initialDraft, selectProduct, validateStep, buildOptimizationRequest", { FACTORS: a.FACTORS });
function profile() { return { product_id: "wardah-lightening-day-cream", brand: "Wardah", product_name: "Unit product", category_id: "moisturizing_cream", category_name: "Moisturizing Cream", profile_origin: "SYNTHETIC_PROTOTYPE_DATA", factors: [
  { key: "factor_a_pct", label: "Humectant", unit: "%", min: 0, max: 10, baseline: 4 },
  { key: "factor_b_pct", label: "Emollient", unit: "%", min: 0, max: 15, baseline: 8 },
  { key: "factor_c_pct", label: "Structurant", unit: "%", min: 0, max: 5, baseline: 2.2 },
] }; }
function validDraft() { return { ...draft.selectProduct(draft.initialDraft("Terasa kurang melembapkan"), profile()), confirmed: true }; }
function route(fetch, env = { SPONTAN_BACKEND_URL: "http://backend.internal" }) {
  return moduleAt("../app/api/ai-reformulation/[action]/route.ts", "POST, GET", {
    backendUrl: path => new URL(path, "http://backend.internal"), process: { env }, fetch,
  });
}
function request(body = "{}", type = "application/json") {
  return new Request("https://app.example/api/ai-reformulation/optimize", { method: "POST", headers: { "Content-Type": type }, body });
}
function context(action = "optimize") { return { params: Promise.resolve({ action }) }; }
// Explicit unit-test fixture, not evidence of model quality.
function emptyResult() {
  return { mode: "model_assisted_product_search", status: "NO_FEASIBLE_ALTERNATIVE_FOUND",
    product: profile(), model_version: "unit-fixture", data_origin: "SYNTHETIC_PROTOTYPE_DATA", disclaimer: a.AI_DISCLAIMER,
    baseline: { composition: { factor_a_pct: 4, factor_b_pct: 8, factor_c_pct: 2.2 },
      predicted_responses: { hydration_ratio: 1.56, stickiness_score_0_10: 3.2, oiliness_score_0_10: 2.6, consistency_index: 28816 },
      constraint_checks: { hydration_ratio_min: true } },
    target_constraints: { hydration_ratio_min: 1.25 }, fixed: [],
    effective_bounds: { factor_a_pct: { min: 0, max: 10 }, factor_b_pct: { min: 0, max: 15 }, factor_c_pct: { min: 0, max: 5 } },
    process: { sampled_count: 10000, valid_output_count: 10000, feasible_alternative_count: 0,
      per_target_pass_count: { hydration_ratio_min: 3000 }, returned_count: 0, seed: 42, ranking: "unit-fixture", min_diversity_distance: 0.03 },
    candidates: [], limitations: ["Unit fixture only"] };
}
test("draft maps exactly three factors, numerical constraints, fixed factors and adjustable bounds", () => {
  const d = validDraft(); d.ingredients[2].fixed = true;
  const r = JSON.parse(JSON.stringify(draft.buildOptimizationRequest(d)));
  assert.deepEqual(r.baseline, { factor_a_pct: 4, factor_b_pct: 8, factor_c_pct: 2.2 });
  assert.deepEqual(r.target_constraints, { hydration_ratio_min: 1.25, stickiness_score_0_10_max: 4.5 });
  assert.equal(r.product_id, profile().product_id);
  assert.deepEqual(r.fixed, ["factor_c_pct"]); assert.equal(r.bounds.factor_c_pct, undefined);
  assert.equal(r.top_k, 3); assert.equal(r.seed, 42); assert.equal(r.insight, undefined); assert.equal(r.temperature, undefined);
});
test("stickiness decrease maps to maximum, no hidden hydration or preserve constraints", () => {
  const d = validDraft(); d.target = "stickiness"; d.direction = "decrease"; d.targetValue = 3.5;
  assert.deepEqual(JSON.parse(JSON.stringify(draft.buildOptimizationRequest(d).target_constraints)), { stickiness_score_0_10_max: 3.5 });
});
test("study ranges, finite values, target caps, duplicate features and unconfirmed insight are rejected", () => {
  for (const mutate of [d => d.ingredients[0].concentration = 11, d => d.ingredients[1].max = 16,
    d => d.ingredients[2].concentration = NaN, d => d.targetValue = Infinity, d => d.stickinessLimit = 11,
    d => d.ingredients[1].feature = d.ingredients[0].feature, d => d.confirmed = false]) {
    const d = validDraft(); mutate(d); assert.throws(() => draft.buildOptimizationRequest(d));
  }
});
test("all fixed factors remain legal so backend can return honest empty search", () => {
  const d = validDraft(); d.ingredients.forEach(i => i.fixed = true);
  assert.equal(draft.buildOptimizationRequest(d).fixed.length, 3);
});
test("predict and optimize use same-origin POST, real payload and no-store", async () => {
  const calls = []; const output = emptyResult();
  const c = api(async (url, options) => { calls.push({ url, options }); return Response.json(url.endsWith("predict") ?
    { product: output.product, model_version: output.model_version, data_origin: output.data_origin, disclaimer: output.disclaimer, predicted_responses: output.baseline.predicted_responses } : output); });
  await c.predictComposition(profile().product_id, output.baseline.composition);
  await c.optimizeComposition(draft.buildOptimizationRequest(validDraft()));
  assert.equal(calls[0].url, "/api/ai-reformulation/predict"); assert.equal(calls[1].url, "/api/ai-reformulation/optimize");
  assert.equal(calls[1].options.cache, "no-store"); assert.equal(calls[1].options.method, "POST");
});
test("empty result is accepted; fabricated/malformed results and provenance are rejected", () => {
  a.validateOptimization(emptyResult());
  for (const mutate of [r => r.status = "CANDIDATES_FOUND", r => r.disclaimer = "100% accurate", r => r.data_origin = "measured",
    r => r.baseline.predicted_responses.hydration_ratio = NaN, r => r.baseline.constraint_checks = null,
    r => r.process.returned_count = 1, r => r.process.per_target_pass_count.hydration_ratio_min = 11000]) {
    const r = emptyResult(); mutate(r); assert.throws(() => a.validateOptimization(r));
  }
});
test("client surfaces HTTP/network failures without fallback predictions", async () => {
  for (const status of [422, 429, 503]) await assert.rejects(() => api(async () => Response.json({ detail: "Controlled failure" }, { status })).optimizeComposition({}), /Controlled failure/);
  await assert.rejects(() => api(async () => { throw Error("Network failure"); }).optimizeComposition({}), /Koneksi AI backend gagal/);
});
test("proxy forwards only fixed operations with no cookies, redirect or caching", async () => {
  let call; const r = route(async (url, options) => { call = { url, options }; return Response.json(emptyResult()); });
  assert.equal((await r.POST(request(), context())).status, 200);
  assert.equal(call.url.href, "http://backend.internal/ai-reformulation/optimize");
  assert.equal(call.options.cache, "no-store"); assert.equal(call.options.redirect, "error"); assert.equal(call.options.headers.Cookie, undefined);
  assert.equal((await r.POST(request(), context("https://evil.example"))).status, 404);
});
test("proxy rejects malformed JSON, primitive, wrong media type and oversized chunked body", async () => {
  const r = route(() => { throw Error("Must not fetch"); });
  assert.equal((await r.POST(request("{bad"), context())).status, 422);
  assert.equal((await r.POST(request("null"), context())).status, 422);
  assert.equal((await r.POST(request("{}", "application/json-bad"), context())).status, 415);
  const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(" ".repeat(16000))); c.enqueue(new TextEncoder().encode(" ".repeat(500))); c.close(); } });
  const streamed = new Request("https://app.example", { method: "POST", body: stream, duplex: "half", headers: { "Content-Type": "application/json" } });
  assert.equal((await r.POST(streamed, context())).status, 413);
});
test("missing configuration fails closed; upstream errors are sanitized", async () => {
  assert.equal((await route(() => { throw Error("Must not fetch"); }, {}).POST(request(), context())).status, 503);
  for (const status of [422, 429, 503, 500]) {
    const out = await route(async () => Response.json({ detail: "Traceback SECRET /private/model" }, { status })).POST(request(), context());
    assert.equal(out.status, status === 500 ? 502 : status); assert.doesNotMatch(await out.text(), /SECRET|Traceback|private/);
  }
  assert.equal((await route(async () => new Response("not json")).POST(request(), context())).status, 502);
});


test("product selection sets brand, category and distinct factor baseline, without version", () => {
  assert.equal(draft.validateStep(0, draft.initialDraft()), "Pilih brand dan product dari katalog backend.");
  const second = profile(); second.product_id = "second"; second.brand = "Emina"; second.category_name = "Gel Moisturizer"; second.factors[0].baseline = 3;
  const d = draft.selectProduct(validDraft(), second);
  assert.equal(d.brand, "Emina"); assert.equal(d.category, "Gel Moisturizer");
  assert.equal(d.ingredients[0].concentration, 3); assert.equal(d.confirmed, false); assert.equal(d.version, undefined);
});
test("catalog client and GET proxy forward only products and surface failures", async () => {
  const catalog = { catalog_version: "unit", data_origin: "SYNTHETIC_PROTOTYPE_DATA", products: [profile()], notice: "Unit fixture", disclaimer: a.AI_DISCLAIMER };
  let call;
  const c = api(async (url, options) => { call = { url, options }; return Response.json(catalog); });
  assert.equal((await c.fetchProductCatalog()).products.length, 1);
  assert.equal(call.url, "/api/ai-reformulation/products"); assert.equal(call.options.cache, "no-store");
  const r = route(async (url, options) => { call = { url, options }; return Response.json(catalog); });
  const req = new Request("https://app.example/api/ai-reformulation/products");
  assert.equal((await r.GET(req, context("products"))).status, 200);
  assert.equal(call.url.href, "http://backend.internal/ai-reformulation/products");
  assert.equal((await r.GET(req, context("predict"))).status, 404);
  assert.equal((await route(() => { throw Error("Must not fetch"); }, {}).GET(req, context("products"))).status, 503);
  await assert.rejects(() => api(async () => { throw Error("Offline"); }).fetchProductCatalog(), /Katalog produk tidak dapat dimuat/);
});
test("optimizer response for a different product is rejected", async () => {
  const result = emptyResult(); result.product.product_id = "wrong-product";
  await assert.rejects(() => api(async () => Response.json(result)).optimizeComposition(draft.buildOptimizationRequest(validDraft())), /tidak sesuai request/);
});
