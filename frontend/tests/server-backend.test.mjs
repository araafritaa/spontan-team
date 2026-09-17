import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import { stripTypeScriptTypes } from "node:module";

const helperSource = readFileSync(new URL("../lib/server-backend.ts", import.meta.url), "utf8");
const routeSource = readFileSync(new URL("../app/api/formula-rescue/[action]/route.ts", import.meta.url), "utf8");
function compile(source, globals) {
  // Parse/strip real TS with Node, independently of the compiler package API.
  // Inject the single server dependency for isolated route tests.
  const names = source === helperSource ? "backendUrl" : "GET, POST";
  const code = stripTypeScriptTypes(source)
    .replace(/^import .*$/gm, "")
    .replace(/^export /gm, "") + `\nObject.assign(exports, { ${names} });`;
  const exports = {};
  vm.runInNewContext(code, { exports, URL, Response, AbortSignal, TextDecoder, ...globals });
  return exports;
}
function helper(env = {}) { return compile(helperSource, { process: { env } }); }

test("binding wins over the old backend and preserves service prefixes", () => {
  const h = helper({ SPONTAN_BACKEND_URL: "http://backend.internal/service/", FORMULARESCUE_API_URL: "https://old.example", VERCEL: "1" });
  assert.equal(h.backendUrl("/ready").href, "http://backend.internal/service/ready");
  assert.equal(h.backendUrl("/formulas?offset=0&limit=100").href, "http://backend.internal/service/formulas?offset=0&limit=100");
});
test("missing binding on Vercel fails closed rather than using the old default", () => {
  assert.throws(() => helper({ VERCEL: "1" }).backendUrl("/health"), /Backend binding unavailable/);
});
test("local unified API and explicit legacy HTTPS remain supported", () => {
  assert.equal(helper({ FORMULARESCUE_API_URL: "http://127.0.0.1:8001" }).backendUrl("/health").href, "http://127.0.0.1:8001/health");
  assert.equal(helper({ FORMULARESCUE_API_URL: "https://old.example", VERCEL: "1" }).backendUrl("/health").href, "https://old.example/health");
});
test("invalid protocols, credentials, query/hash bases and external paths are rejected", () => {
  for (const url of ["file:///tmp/model", "https://user:pass@example.com", "https://example.com?token=secret", "https://example.com#secret"]) {
    assert.throws(() => helper({ SPONTAN_BACKEND_URL: url }).backendUrl("/health"));
  }
  assert.throws(() => helper({ FORMULARESCUE_API_URL: "http://untrusted.example" }).backendUrl("/health"));
  assert.throws(() => helper().backendUrl("//external.example"));
});
test("runtime environment is read on each call, not captured at build/import", () => {
  const env = { VERCEL: "1" }; const h = helper(env);
  assert.throws(() => h.backendUrl("/ready"), /Backend binding unavailable/);
  env.SPONTAN_BACKEND_URL = "https://runtime.example";
  assert.equal(h.backendUrl("/ready").href, "https://runtime.example/ready");
});
test("fixed readiness proxy calls the bound service with no-store", async () => {
  let called; const h = helper({ SPONTAN_BACKEND_URL: "http://backend.internal", VERCEL: "1" });
  const route = compile(routeSource, { backendUrl: h.backendUrl, fetch: async (url, options) => {
    called = { url: url.href, options }; return Response.json({ status: "ready" });
  } });
  const result = await route.GET(new Request("https://app.example/api/formula-rescue/ready"), { params: Promise.resolve({ action: "ready" }) });
  assert.equal(result.status, 200); assert.equal(called.url, "http://backend.internal/ready");
  assert.equal(called.options.cache, "no-store"); assert.equal(called.options.redirect, "error");
});
test("missing production binding returns controlled 503 without outgoing fetch", async () => {
  const route = compile(routeSource, { backendUrl: helper({ VERCEL: "1" }).backendUrl, fetch: () => { throw new Error("Unexpected fetch"); } });
  const result = await route.GET(new Request("https://app.example/api/formula-rescue/ready"), { params: Promise.resolve({ action: "ready" }) });
  assert.equal(result.status, 503);
});
