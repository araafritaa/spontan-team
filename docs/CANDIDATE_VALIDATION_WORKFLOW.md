# Candidate validation workflow

Implemented for Formula Rescue and AI Reformulation. Model inference and model artifacts are unchanged.

## Formula Rescue input context

Formula Rescue uses Product Category (fixed to Shampoo), Brand (Putri, Wardah,
Emina, Kahf, LABORÉ), Existing Formula and Unavailable Ingredient. Existing Formula
selects the historical formulation; no manufacturer product recipe is implied.
Brand and product labels are display context only. Changing brand neither filters
the historical catalog nor changes predictions or ranking. Successful analysis
snapshots keep these labels in `display_context`, separate from the AI request.
The request remains formula ID, unavailable-ingredient constraint and `top_k: 8`.
The Rescue Goal field is removed; saved candidate validation remains linked to
the historical formula/execution, not the selected display brand. Existing saved
records with prior insight text remain available in Experimental Data.
AI Reformulation's separate product-aware engine is not changed by this refinement.
Ranked Candidates no longer displays the “What the engine did” panel; its raw
execution evidence remains available in Session Detail / JSON.

## User flow

Select candidate → Open Lab Validation → Select Validation Tests → Save Validation Plan → Pending / Testing
→ Return through Dataset Library / Experimental Data → Completed → Enter actual results
→ Save Validation Result → Compare supported predictions → Retain experimental record.

- Select any of seven tests: stability, viscosity/rheology, pH, sensory, texture/spreadability, hydration, other characterization.
- Pending: save selected tests and optional experiment metadata; no actual-result table or comparison.
- Testing: execution-in-progress plan; no comparison.
- Fill Experiment Data: available after selecting tests in Pending / Testing. Opens
  actual-result fields, changes the editable status to Completed and focuses Experiment ID.
  This does not submit measurements, save automatically or mark the stored plan complete.
  The status dropdown can return to Pending / Testing. Save draft keeps partial data;
  Save Validation Result still requires all selected measurements and experiment metadata.
- Completed: actual fields appear for selected tests. Experiment ID, method/instrument and every selected metric are required to submit.
- Needs revision: failed outcome or manual revision marker. A saved stability FAIL automatically sets this status. It does not change model predictions.
- Save draft can preserve partially entered Completed fields without submitting or evaluating them.
- Changing any field hides the saved comparison until the new result is successfully saved.
- Saving a Pending plan after completion invalidates the prior submitted evaluation; export the earlier result first if it needs to be retained.
- Download saved validation JSON contains the exact candidate/execution snapshot and submitted measurements (null for drafts).

## What is stored

Versioned localStorage key: `spontan.validation.v1`.

Each record retains engine, candidate identity, model version, data provenance, full-precision
composition, executed request, insight, selected tests, status, experiment ID, method/instrument,
notes, protocol confirmation, actual measurements and created/updated/submitted timestamps.

Identity includes execution context, composition and model version, not candidate ID alone.
Saving an existing plan updates the same record; it does not append duplicate experiments.
This version supports one plan per candidate/execution, not replicate experiments.
Maximum 250 records. Storage failure or damaged JSON is reported; no success or automatic
replacement of existing records occurs.

Saved plans/results survive navigation, refresh and reopening the same browser/profile at the
same site origin. Incognito storage, clearing browser data, changing domains or using another
device do not preserve/share that library. Unsubmitted edits require pressing Save draft/plan.
Saved validation metadata is visible to other users of the same browser profile.
The existing access form is not authentication or access control. Do not store confidential
laboratory data here. Export JSON for backup.

**This is browser persistence, not a server database.** No new backend endpoint, filesystem write,
cloud database, shared-account synchronization or training job is introduced.
Existing successful-analysis dashboard history remains in memory; saved experimental
records have their own persistent Experimental Data tab and execution snapshots.

## Predictions and units

| Test | Actual data | Comparable model output |
|---|---|---|
| Stability | PASS / FAIL using documented protocol | None: rescue estimate is not binary PASS/FAIL or a measured stability score |
| Viscosity/rheology | cP with temperature / instrument / protocol in method | None; synthetic consistency index is not cP |
| pH | numeric 0–14 | None |
| Sensory | stickiness and oiliness scores, 0–10 | Same named AI Reformulation scores only |
| Texture/spreadability | observation and method | None; synthetic consistency is not a physical spreadability measurement |
| Hydration | ratio to a documented reference / timepoint | AI Reformulation hydration ratio only |
| Other | measurement name, value, unit and protocol as text | None |

Unsupported predictions are shown as Not predicted / Not comparable, never fabricated.
Protocol/scale/reference confirmation is required before numeric differences are displayed.
This is an explicit user attestation, not proof that the synthetic generator has a real
laboratory-equivalent protocol. If equivalent measurement cannot be established, leave it unchecked.

Difference = actual − predicted.
Percentage difference = 100 × (actual − predicted) / predicted.
Zero prediction: absolute difference remains available, relative percentage is undefined.
No tolerance or automatic success threshold is invented. Differences are observations,
not accuracy metrics, safety/efficacy evidence or proof of generalization.

## Feedback / training boundary

Button: **Save Validation Result**.
Confirmation: result stored and added to the experimental library.
Exports explicitly state `THIS_BROWSER_ONLY` and `NOT_UPLOADED`.

Monthly improvement remains a **planned separate review/training workflow**, not an implemented
scheduler or automatic consequence of submitting a form:
export actual records → quality/protocol checks → resolve replicate/label semantics
→ curate real experimental dataset → train candidate model with leakage-safe evaluation
→ compare to current engine → approve version promotion / preserve rollback.
Drafts, AI predictions and synthetic output are not relabeled as real laboratory ground truth.

## Visual identity

Workbench reference palette: deep navy headers, dark/mid-blue actions, cyan accents,
yellow/cream notes and white/light-blue panels,
rounded cards and minimal shadows. Text badges retain accessible state meaning:
Pending gray-blue, Testing teal, Completed green, Needs revision soft red.

### Workbench / English UI revision

- Ranked Candidates no longer embeds validation forms; each card opens the
  dedicated Lab Validation page with that candidate preselected.
- New Analysis tab order: Choose Product → Insight → Formula & Limits → AI Processing
  → Ranked Candidates → Lab Validation → Evidence.
- Formula Rescue uses its own dedicated validation view and can return to its ranked list.
- View Experimental Data appears below the validation save actions and opens the
  exact saved experiment. It is disabled before saving or while there are unsaved changes.
- Labels, accessible names, client/proxy errors and document language are English.
  User-entered notes/insights and stored execution snapshots are not translated.
- The REAL API RESPONSE / BATCH SEARCH label has been removed.
- Workbench branding replaces the SPONTAN workspace logo and page title.
  The SVG wordmark is a reference-based recreation, not the original official asset;
  replace it with an original PNG/SVG when available.

## Verification

Run from frontend: `npm run typecheck`, `npm run build`,
`node --test tests/lab-validation.test.mjs tests/ai-reformulation.test.mjs tests/server-backend.test.mjs`.

Run from root after build: `py frontend/tests/live-ai-integration.py --browser`.
Tests cover dynamic metrics, numeric bounds, missing measurements, protocol-gated differences,
candidate/execution separation, draft reloading, submitted results, storage errors,
FAIL status, exports and responsive browser UI against the real combined backend.
