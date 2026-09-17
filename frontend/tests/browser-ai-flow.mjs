// Optional real Edge/Chrome UI smoke test. No browser automation package required.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
const root = fileURLToPath(new URL("../../", import.meta.url));
const base = process.argv[2];
assert(base && /^http:\/\/127\.0\.0\.1:\d+$/.test(base), "Only loopback test URLs allowed");
const binary = process.env.AI_TEST_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
assert(existsSync(binary), "Set AI_TEST_BROWSER to a local Edge/Chrome executable");
mkdirSync(resolve(root, "tmp"), { recursive: true });
const profile = mkdtempSync(resolve(root, "tmp", "ai-browser-"));
const listener = createServer();
await new Promise(r => listener.listen(0, "127.0.0.1", r));
const port = listener.address().port;
await new Promise(r => listener.close(r));
const browser = spawn(binary, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--remote-debugging-address=127.0.0.1", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"],
  { windowsHide: true, stdio: "ignore" });
browser.on("error", error => console.error(error.message));
let ws; let sequence = 0; const pending = new Map();
async function until(fn, description) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) { if (await fn()) return; await delay(100); }
  throw Error("Timed out: " + description);
}
function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence; const timer = setTimeout(() => { pending.delete(id); reject(Error(method + " timed out")); }, 10000);
    pending.set(id, { resolve: result => { clearTimeout(timer); resolve(result); }, reject: error => { clearTimeout(timer); reject(error); } });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const out = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (out.exceptionDetails) throw Error(out.exceptionDetails.exception?.description || out.exceptionDetails.text);
  return out.result?.value;
}
async function click(text) {
  await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>!b.disabled&&b.textContent.trim().startsWith(${JSON.stringify(text)}));if(!b)throw Error('Button missing: '+${JSON.stringify(text)});b.click()})()`);
}
async function value(selector, text) {
  await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Input missing');const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(String(text))});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await delay(80);
}
async function stage(name) { await until(() => evaluate(`document.querySelector('.wizard-panel h2')?.textContent===${JSON.stringify(name)}`), name); }
async function nav(name) {
  await evaluate(`(()=>{const b=[...document.querySelectorAll('.wizard-steps button')].find(b=>b.textContent.endsWith(${JSON.stringify(name)})&&!b.disabled);if(!b)throw Error('Stage locked');b.click()})()`);
  await stage(name);
}
try {
  let target;
  await until(async () => {
    try { const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); target = targets.find(t => t.type === "page"); return !!target; }
    catch { return false; }
  }, "browser debugging endpoint");
  ws = new WebSocket(target.webSocketDebuggerUrl);
  ws.addEventListener("message", event => {
    const message = JSON.parse(event.data); const item = pending.get(message.id); if (!item) return;
    pending.delete(message.id); if (message.error) item.reject(Error(message.error.message)); else item.resolve(message.result);
  });
  await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", reject, { once: true }); });
  await call("Page.enable"); await call("Runtime.enable"); await call("Network.enable");
  await call("Browser.setDownloadBehavior", { behavior: "deny" });
  await call("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await call("Page.navigate", { url: base });
  await until(() => evaluate("!!document.querySelector('#username')"), "login");
  await value("#username", "ui-test"); await value("#password", "dummy-only"); await click("Masuk ke workspace");
  await until(() => evaluate("!!document.querySelector('.dashboard-actions')"), "dashboard");
  await click("Start Rescue");
  await until(() => evaluate("!!document.querySelector('#rescue-formula:not(:disabled)')"), "rescue formula catalog");
  await value("#rescue-formula", 7); await value("#rescue-ingredient", "Plantacare 818");
  await value("#rescue-insight", "Maintain cleansing character while replacing the unavailable ingredient");
  await click("Run Formula Rescue");
  await until(() => evaluate("document.querySelectorAll('.rescue-candidate').length===3"), "rescue top three");
  await evaluate("document.querySelector('.lab-validation').open=true");
  await value("#lab-experiment-288", "RESCUE-UI-01"); await value("#lab-outcome-288", "pass");
  await value("#lab-stability-288", "0.91"); await value("#lab-method-288", "Physical stability protocol");
  await evaluate("(()=>{const original=URL.createObjectURL;URL.createObjectURL=blob=>{window.__rescueLabBlob=blob;return original.call(URL,blob)}})()");
  await click("Download validation feedback");
  const rescueLab = JSON.parse(await evaluate("window.__rescueLabBlob.text()"));
  assert.equal(rescueLab.candidate_id, 288); assert.equal(rescueLab.measured_stability_0_1, .91); assert.equal(rescueLab.ingestion_status, "NOT_UPLOADED");
  await evaluate("[...document.querySelectorAll('.sidebar nav button')].find(button=>button.textContent.includes('Dashboard')).click()");
  await until(() => evaluate("document.querySelectorAll('.analysis-row').length>=1"), "rescue session history");
  await click("New Analysis"); await stage("Choose Product");
  await until(() => evaluate("document.querySelector('#product-brand')?.value==='Wardah'"), "backend product catalog");
  assert.equal(await evaluate("!!document.querySelector('#formula-version')"), false);
  await value("#product-name", "wardah-radiant-charge-serum");
  assert.equal(await evaluate("document.querySelector('#product-category').value"), "Face Serum");
  await value("#product-name", "wardah-lightening-day-cream");
  await click("Lanjut"); await stage("Insight / Reformulation Goal");
  await value("#clean-insight", "Terasa kurang melembapkan");
  await evaluate("[...document.querySelectorAll('.checkbox-label input')].at(-1).click()");
  await click("Lanjut"); await stage("Formula & Limits"); await click("Lanjut"); await stage("AI Processing");
  await click("Prediksi baseline");
  await until(() => evaluate("document.querySelector('.wizard-panel table caption')?.textContent.includes('Predicted responses')"), "real baseline prediction");
  await click("Generate recommendations"); await stage("Ranked Candidates");
  assert.equal(await evaluate("document.querySelectorAll('.rescue-candidate').length"), 3);
  await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await delay(120);
  assert(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"), "Mobile page must not overflow horizontally");
  await click("Lanjut"); await stage("Evidence");
  const session = JSON.parse(await evaluate("document.querySelector('.wizard-panel pre').textContent"));
  assert.equal(session.response.model_version, "synthetic_product_polynomial_ridge_v1");
  assert.equal(session.response.process.sampled_count, 10000);
  assert.equal(session.response.candidates.length, 3);
  await click("Lanjut"); await stage("Lab Validation");
  await value("#lab-candidate", session.response.candidates[2].candidate_id);
  await value("#experiment-id", "UI-test-plan"); await value("#test-method", "Physical lab validation to plan");
  await evaluate("(()=>{const original=URL.createObjectURL;URL.createObjectURL=blob=>{window.__labBlob=blob;return original.call(URL,blob)}})()");
  await click("Download lab-plan draft JSON");
  const lab = JSON.parse(await evaluate("window.__labBlob.text()"));
  assert.equal(lab.candidate_id, session.response.candidates[2].candidate_id);
  assert.equal(lab.measured_results, null); assert.equal(lab.model_executed, true);
  await nav("Formula & Limits"); await value('input[aria-label="Humectant system concentration"]', 11);
  assert(await evaluate('document.querySelector(\'input[aria-label="Humectant system concentration"]\').validity.rangeOverflow'));
  await value('input[aria-label="Humectant system concentration"]', 4);
  assert.equal(await evaluate("[...document.querySelectorAll('.wizard-steps button')].find(b=>b.textContent.endsWith('Ranked Candidates')).disabled"), true);
  await nav("Insight / Reformulation Goal"); await value("#target-value", 100);
  await evaluate("[...document.querySelectorAll('.checkbox-label input')].at(-1).click()");
  await click("Lanjut"); await stage("Formula & Limits"); await click("Lanjut"); await stage("AI Processing");
  await call("Network.setBlockedURLs", { urls: ["*api/ai-reformulation*"] });
  await click("Generate recommendations");
  await until(() => evaluate("document.querySelector('[role=alert]')?.textContent.includes('Koneksi AI backend gagal')"), "honest network error");
  await call("Network.setBlockedURLs", { urls: [] }); await click("Generate recommendations"); await stage("Ranked Candidates");
  assert.equal(await evaluate("document.querySelectorAll('.rescue-candidate').length"), 0);
  assert(await evaluate("document.querySelector('.wizard-panel')?.textContent.includes('No feasible alternative found')"));
  await nav("Choose Product"); await value("#product-brand", "Emina");
  assert.equal(await evaluate("document.querySelector('#product-category').value"), "Moisturizing Cream");
  assert(await evaluate("[...document.querySelector('#product-name').options].every(o=>!o.value||o.value.startsWith('emina-'))"));
  await click("Lanjut"); await stage("Insight / Reformulation Goal"); await value("#target-value", 1.25);
  await evaluate("[...document.querySelectorAll('.checkbox-label input')].at(-1).click()");
  await click("Lanjut"); await stage("Formula & Limits"); await click("Lanjut"); await stage("AI Processing");
  await click("Generate recommendations"); await stage("Ranked Candidates"); await click("Lanjut"); await stage("Evidence");
  const second = JSON.parse(await evaluate("document.querySelector('.wizard-panel pre').textContent"));
  assert.equal(second.request.product_id, "emina-bright-stuff-moisturizing-cream");
  assert.equal(second.response.candidates.length, 3);
  assert.notDeepEqual(second.response.baseline.predicted_responses, session.response.baseline.predicted_responses);
  assert.notDeepEqual(second.response.candidates[0].composition, session.response.candidates[0].composition);
  await evaluate("[...document.querySelectorAll('.sidebar nav button')].find(button=>button.textContent.includes('Dashboard')).click()");
  await until(() => evaluate("document.querySelectorAll('.analysis-row').length>=4"), "real session history");
  assert.equal(await evaluate("document.body.textContent.toLowerCase().includes('prototype / demo')"), false);
  console.log(JSON.stringify({ status: "PASS", browser: "real headless Chromium UI", checks: ["login", "dashboard", "brand_product_category_dropdowns", "different_product_results", "rescue_top_3", "rescue_lab_feedback", "baseline_prediction", "ai_top_3", "390px_no_page_overflow", "evidence", "candidate_bound_lab_plan", "invalid_range", "stale_result_invalidation", "network_error_and_retry", "empty_search", "session_history"] }));
} finally {
  if (ws?.readyState === WebSocket.OPEN) { await call("Browser.close").catch(() => {}); ws.close(); }
  for (const item of pending.values()) item.reject(Error("Test closed")); pending.clear();
  if (browser.exitCode === null) browser.kill();
}
