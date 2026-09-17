// Optional real Edge/Chrome UI smoke test. No browser automation package required.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
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
  assert.equal(await evaluate("document.documentElement.lang"), "en");
  assert.equal(await evaluate("document.querySelector('.workbench-brand svg')?.getAttribute('aria-label')"), "Workbench by Paragon Corp");
  await value("#username", "ui-test"); await value("#password", "dummy-only"); await click("Enter workspace");
  await until(() => evaluate("!!document.querySelector('.dashboard-actions')"), "dashboard");
  await click("Start Rescue");
  await until(() => evaluate("!!document.querySelector('#rescue-formula:not(:disabled)')"), "rescue formula catalog");
  assert.equal(await evaluate("document.body.textContent.includes('RESCUE PROCESS TRACE')"), false);
  await value("#rescue-formula", 7); await value("#rescue-ingredient", "Plantacare 818");
  assert.deepEqual(await evaluate("[...document.querySelector('#rescue-brand').options].map(o=>o.value)"), ["Putri", "Wardah", "Emina", "Kahf", "LABORÉ"]);
  assert.equal(await evaluate("document.querySelector('#rescue-category').value"), "Shampoo");
  assert.equal(await evaluate("document.querySelector('#rescue-category').readOnly"), true);
  assert.equal(await evaluate("!!document.querySelector('#rescue-insight')"), false);
  await evaluate("window.rescueRequests=[];window.originalRescueFetch=window.fetch;window.fetch=(url,options)=>{if(String(url).endsWith('/api/formula-rescue/reformulate'))window.rescueRequests.push(JSON.parse(options.body));return window.originalRescueFetch(url,options)}");
  await click("Run Formula Rescue");
  await until(() => evaluate("document.querySelectorAll('.rescue-candidate').length===3"), "rescue top three");
  const originalRescueCards = await evaluate("[...document.querySelectorAll('.rescue-candidate')].map(c=>c.textContent)");
  await value("#rescue-brand", "LABORÉ");
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.rescue-candidate')].map(c=>c.textContent)"), originalRescueCards);
  await click("Run Formula Rescue");
  await until(() => evaluate("document.querySelectorAll('.rescue-candidate').length===3"), "display-only brand repeat search");
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.rescue-candidate')].map(c=>c.textContent)"), originalRescueCards);
  assert.deepEqual(await evaluate("window.rescueRequests"), [0,1].map(()=>({formula_id:7,constraint:{type:"ingredient_unavailable",ingredient:"Plantacare 818"},top_k:8})));
  assert.equal(await evaluate("document.querySelectorAll('.rescue-candidate .candidate-validation').length"), 0);
  await click("Open Lab Validation");
  await until(() => evaluate("!!document.querySelector('.rescue-lab-page .candidate-validation')"), "dedicated rescue lab validation");
  assert.equal(await evaluate("[...document.querySelectorAll('.candidate-validation button')].find(b=>b.textContent==='Fill Experiment Data').disabled"), true);
  await evaluate("[...document.querySelectorAll('.candidate-validation .validation-tests label')].find(label=>label.textContent.includes('Stability Test')).querySelector('input').click()");
  await click("Save Validation Plan");
  await until(() => evaluate("document.querySelector('.validation-confirmation')?.textContent.includes('plan saved')"), "pending rescue plan saved");
  assert.equal(await evaluate("document.querySelectorAll('.validation-summary').length"), 0);
  await value('.candidate-validation select[id$="-status"]', "Testing"); await click("Save Validation Plan");
  await click("Fill Experiment Data");
  assert.equal(await evaluate("document.querySelector('.candidate-validation select[id$=\-status\]').value"), "Completed");
  assert.equal(await evaluate("document.activeElement.id.endsWith('-experiment')"), true);
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('spontan.validation.v1'))[0].draft.status"), "Testing");
  await value('.candidate-validation input[id$="-experiment"]', "RESCUE-UI-01");
  await value('.candidate-validation input[id$="-method"]', "Physical stability protocol");
  await value('.candidate-validation select[aria-label="Actual Stability"]', "FAIL");
  await click("Save Validation Result");
  await until(() => evaluate("document.querySelector('.validation-summary')?.textContent.includes('FAIL')"), "actual rescue result stored");
  const rescueLab = await evaluate("JSON.parse(localStorage.getItem('spontan.validation.v1'))[0]");
  assert.equal(rescueLab.context.candidateId, "288"); assert.equal(rescueLab.draft.status, "Needs revision");
  assert.equal(rescueLab.draft.actual.stability_outcome, "FAIL"); assert(rescueLab.submittedAt);
  assert(await evaluate("document.querySelector('.validation-summary').textContent.includes('Not comparable')"));
  await evaluate("[...document.querySelectorAll('.sidebar nav button')].find(button=>button.textContent.includes('Dashboard')).click()");
  await until(() => evaluate("document.querySelectorAll('.analysis-row').length>=1"), "rescue session history");
  await click("New Analysis"); await stage("Choose Product");
  await until(() => evaluate("document.querySelector('#product-brand')?.value==='Wardah'"), "backend product catalog");
  assert.equal(await evaluate("!!document.querySelector('#formula-version')"), false);
  await value("#product-name", "wardah-radiant-charge-serum");
  assert.equal(await evaluate("document.querySelector('#product-category').value"), "Face Serum");
  await value("#product-name", "wardah-lightening-day-cream");
  await click("Continue"); await stage("Insight / Reformulation Goal");
  await value("#clean-insight", "Terasa kurang melembapkan");
  await evaluate("[...document.querySelectorAll('.checkbox-label input')].at(-1).click()");
  await click("Continue"); await stage("Formula & Limits"); await click("Continue"); await stage("AI Processing");
  await click("Predict baseline");
  await until(() => evaluate("document.querySelector('.wizard-panel table caption')?.textContent.includes('Predicted responses')"), "real baseline prediction");
  await click("Generate recommendations"); await stage("Ranked Candidates");
  assert.equal(await evaluate("document.querySelectorAll('.rescue-candidate').length"), 3);
  await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await delay(120);
  assert(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"), "Mobile page must not overflow horizontally");
  assert.equal(await evaluate("document.querySelectorAll('.rescue-candidate .candidate-validation').length"), 0);
  assert.equal(await evaluate("document.querySelectorAll('.candidate-lab-button').length"), 3);
  assert.equal(await evaluate("document.body.textContent.includes('REAL API RESPONSE / BATCH SEARCH')"), false);
  assert.equal(await evaluate("document.body.textContent.includes('What the engine did')"), false);
  await evaluate('document.querySelector(\'[aria-label="Open lab validation for Candidate 3"]\').click()');
  await stage("Lab Validation");
  assert.equal(await evaluate("document.querySelector('#lab-candidate').selectedIndex"), 2);
  assert.equal(await evaluate("[...document.querySelectorAll('.wizard-steps button')].findIndex(b=>b.textContent==='Lab Validation')"), 5);
  assert.equal(await evaluate("[...document.querySelectorAll('.wizard-steps button')].findIndex(b=>b.textContent==='Evidence')"), 6);
  await click("Continue"); await stage("Evidence");
  const session = JSON.parse(await evaluate("document.querySelector('.wizard-panel pre').textContent"));
  assert.equal(session.response.model_version, "synthetic_product_polynomial_ridge_v1");
  assert.equal(session.response.process.sampled_count, 10000);
  assert.equal(session.response.candidates.length, 3);
  await nav("Lab Validation");
  await value("#lab-candidate", session.response.candidates[2].candidate_id);
  await evaluate("for(const text of ['Hydration Measurement','Viscosity / Rheology Test','pH Test'])document.querySelectorAll('.validation-tests label').forEach(label=>{if(label.textContent.includes(text))label.querySelector('input').click()})");
  await value('.candidate-validation input[id$="-experiment"]', "UI-test-plan");
  await value('.candidate-validation input[id$="-method"]', "Physical matched protocol");
  await click("Save Validation Plan");
  await until(() => evaluate("document.querySelector('.validation-confirmation')?.textContent.includes('plan saved')"), "AI pending plan saved");
  let lab = await evaluate("JSON.parse(localStorage.getItem('spontan.validation.v1'))[0]");
  assert.equal(lab.context.candidateId, session.response.candidates[2].candidate_id);
  assert.equal(lab.submittedAt, null); assert.deepEqual(lab.context.composition, session.response.candidates[2].composition);
  assert.equal(await evaluate("document.querySelectorAll('.validation-summary').length"), 0);
  await click("Fill Experiment Data"); await click("Save Validation Result");
  assert(await evaluate("document.querySelector('.candidate-validation [role=alert]')?.textContent.includes('actual result')"));
  await value('input[aria-label="Actual Hydration"]', 1.58);
  await value('input[aria-label="Actual Viscosity"]', 5100);
  await value('input[aria-label="Actual pH"]', 15); await click("Save Validation Result");
  assert(await evaluate("document.querySelector('.candidate-validation [role=alert]')?.textContent.includes('pH')"));
  await value('input[aria-label="Actual pH"]', 5.5); await click("Save Validation Result");
  await until(() => evaluate("document.querySelector('.validation-summary')?.textContent.includes('Protocol / scale not confirmed')"), "no mismatched protocol comparison");
  await evaluate("document.querySelector('.validation-comparable input').click()"); await click("Save Validation Result");
  await until(() => evaluate("document.querySelector('.validation-summary')?.textContent.includes('%')"), "prediction vs actual comparison");
  assert(await evaluate("document.documentElement.scrollWidth<=innerWidth+1"), "Validation mobile layout must not overflow");
  lab = await evaluate("JSON.parse(localStorage.getItem('spontan.validation.v1'))[0]");
  assert.equal(lab.draft.status, "Completed"); assert(lab.submittedAt);
  assert.equal(lab.draft.actual.hydration_ratio, "1.58");
  assert.equal(lab.context.modelVersion, session.response.model_version);
  await nav("Formula & Limits"); await value('input[aria-label="Humectant system concentration"]', 11);
  assert(await evaluate('document.querySelector(\'input[aria-label="Humectant system concentration"]\').validity.rangeOverflow'));
  await value('input[aria-label="Humectant system concentration"]', 4);
  assert.equal(await evaluate("[...document.querySelectorAll('.wizard-steps button')].find(b=>b.textContent.endsWith('Ranked Candidates')).disabled"), true);
  await nav("Insight / Reformulation Goal"); await value("#target-value", 100);
  await evaluate("[...document.querySelectorAll('.checkbox-label input')].at(-1).click()");
  await click("Continue"); await stage("Formula & Limits"); await click("Continue"); await stage("AI Processing");
  await call("Network.setBlockedURLs", { urls: ["*api/ai-reformulation*"] });
  await click("Generate recommendations");
  await until(() => evaluate("document.querySelector('[role=alert]')?.textContent.includes('AI engine connection failed')"), "honest network error");
  await call("Network.setBlockedURLs", { urls: [] }); await click("Generate recommendations"); await stage("Ranked Candidates");
  assert.equal(await evaluate("document.querySelectorAll('.rescue-candidate').length"), 0);
  assert(await evaluate("document.querySelector('.wizard-panel')?.textContent.includes('No feasible alternative found')"));
  await nav("Choose Product"); await value("#product-brand", "Emina");
  assert.equal(await evaluate("document.querySelector('#product-category').value"), "Moisturizing Cream");
  assert(await evaluate("[...document.querySelector('#product-name').options].every(o=>!o.value||o.value.startsWith('emina-'))"));
  await click("Continue"); await stage("Insight / Reformulation Goal"); await value("#target-value", 1.25);
  await evaluate("[...document.querySelectorAll('.checkbox-label input')].at(-1).click()");
  await click("Continue"); await stage("Formula & Limits"); await click("Continue"); await stage("AI Processing");
  await click("Generate recommendations"); await stage("Ranked Candidates"); await click("Continue"); await stage("Lab Validation"); await click("Continue"); await stage("Evidence");
  const second = JSON.parse(await evaluate("document.querySelector('.wizard-panel pre').textContent"));
  assert.equal(second.request.product_id, "emina-bright-stuff-moisturizing-cream");
  assert.equal(second.response.candidates.length, 3);
  assert.notDeepEqual(second.response.baseline.predicted_responses, session.response.baseline.predicted_responses);
  assert.notDeepEqual(second.response.candidates[0].composition, session.response.candidates[0].composition);
  await nav("Lab Validation");
  await until(() => evaluate("!!document.querySelector('.validation-tests')"), "second product lab ready");
  assert.equal(await evaluate("[...document.querySelectorAll('.validation-library-link button')][0].disabled"), true);
  await evaluate("[...document.querySelectorAll('.validation-tests label')].find(label=>label.textContent.includes('Hydration Measurement')).querySelector('input').click()");
  await click("Save Validation Plan");
  await until(() => evaluate("document.querySelector('.validation-confirmation')?.textContent.includes('plan saved')"), "second product plan saved");
  await click("View Experimental Data");
  await until(() => evaluate("document.querySelector('.library-detail h2')?.textContent.includes('Bright Stuff')"), "AI analysis to experimental data");
  assert.equal(await evaluate("document.querySelector('.candidate-validation select').value"), "Pending");
  await evaluate("[...document.querySelectorAll('.sidebar nav button')].find(button=>button.textContent.includes('Dashboard')).click()");
  await until(() => evaluate("document.querySelectorAll('.analysis-row').length>=4"), "real session history");
  assert.equal(await evaluate("document.body.textContent.toLowerCase().includes('prototype / demo')"), false);
  // The saved Rescue validation should also be accessible from its dedicated page.
  await evaluate("[...document.querySelectorAll('.sidebar nav button')].find(button=>button.textContent.includes('Formula Rescue')).click()");
  await until(() => evaluate("!!document.querySelector('#rescue-formula:not(:disabled)')"), "rescue reload catalog");
  await value("#rescue-formula", 7); await value("#rescue-ingredient", "Plantacare 818");
  await value("#rescue-brand", "LABORÉ");
  await click("Run Formula Rescue");
  await until(() => evaluate("document.querySelectorAll('.rescue-candidate').length===3"), "rescue repeat candidates");
  await click("Open Lab Validation");
  await until(() => evaluate("!!document.querySelector('.rescue-lab-page .candidate-validation')"), "saved rescue lab restored");
  await click("View Experimental Data");
  await until(() => evaluate("document.querySelector('.library-detail h2')?.textContent.includes('Formula 288')"), "direct experimental record navigation");
  // Reload: analysis history is transient, but saved experiments remain accessible.
  await call("Page.reload");
  await until(() => evaluate("!!document.querySelector('#username')"), "login after refresh");
  await value("#username", "ui-test"); await value("#password", "dummy-only"); await click("Enter workspace");
  await until(() => evaluate("!!document.querySelector('.dashboard-actions')"), "dashboard after refresh");
  await evaluate("[...document.querySelectorAll('.sidebar nav button')].find(button=>button.textContent.includes('Dataset Library')).click()");
  await click("Experimental Data");
  await until(() => evaluate("document.querySelectorAll('.session-card').length===3"), "persisted experimental library");
  await evaluate("[...document.querySelectorAll('.session-title')].find(b=>b.textContent.includes('Candidate #3')).click()");
  await until(() => evaluate("document.querySelector('.validation-summary')?.textContent.includes('1.58')"), "restored actual results");
  await value('.candidate-validation select[id$="-status"]', "Pending"); await click("Save Validation Plan");
  await until(() => evaluate("document.querySelector('.validation-confirmation')?.textContent.includes('plan saved')"), "return to pending draft");
  assert.equal(await evaluate("document.querySelectorAll('.validation-summary').length"), 0);
  await click("← Back to experimental library");
  await evaluate("[...document.querySelectorAll('.session-title')].find(b=>b.textContent.includes('Candidate #3')).click()");
  assert.equal(await evaluate('document.querySelector(".candidate-validation select").value'), "Pending");
  assert(await evaluate("document.body.textContent.includes('Waiting for laboratory results')"));
  await value('.candidate-validation select[id$="-status"]', "Completed"); await click("Save Validation Result");
  await until(() => evaluate("!!document.querySelector('.validation-summary')"), "restored draft completed");
  await evaluate("(()=>{const original=URL.createObjectURL;URL.createObjectURL=blob=>{window.__validationExport=blob;return original.call(URL,blob)}})()");
  await click("Download saved validation JSON");
  const exported = JSON.parse(await evaluate("window.__validationExport.text()"));
  assert.equal(exported.storage_scope, "THIS_BROWSER_ONLY"); assert.equal(exported.training_ingestion, "NOT_UPLOADED");
  assert.equal(exported.measured_results.hydration_ratio, "1.58");
  await call("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1100, deviceScaleFactor: 1, mobile: false });
  await evaluate("window.scrollTo(0,0)");
  await delay(120);
  const screenshot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  writeFileSync(resolve(root, "tmp", "validation-workflow.png"), Buffer.from(screenshot.data, "base64"));
  console.log(JSON.stringify({ status: "PASS", browser: "real headless Chromium UI", checks: ["login", "dashboard", "brand_product_category_dropdowns", "different_product_results", "rescue_top_3", "rescue_validation_plan_and_failure", "baseline_prediction", "ai_top_3", "390px_no_page_overflow", "evidence", "candidate_bound_plan_and_results", "dedicated_lab_pages", "lab_before_evidence", "experimental_data_button", "workbench_english_ui", "required_actual_fields", "protocol_gated_comparison", "refresh_persistence", "experimental_library_return", "validation_json_export", "pending_hides_comparison", "invalid_range", "stale_result_invalidation", "network_error_and_retry", "empty_search", "session_history"] }));
} finally {
  if (ws?.readyState === WebSocket.OPEN) { await call("Browser.close").catch(() => {}); ws.close(); }
  for (const item of pending.values()) item.reject(Error("Test closed")); pending.clear();
  if (browser.exitCode === null) browser.kill();
}
