# API Contract — Agree Before Parallel Coding

Status: unified backend and AI frontend wiring implemented locally, version 0.1.0. Vercel runtime deployment is not yet verified. Team owner/reviewer: TBD.

## Candidate validation persistence (2026-09-18)

Both engines open dedicated Lab Validation views from candidate cards, supporting selected tests, Pending / Testing plans,
Completed actual results and Needs revision outcomes. Saved plans/results survive
refresh in this browser via versioned localStorage and appear under Dataset Library
→ Experimental Data. They include exact execution snapshots and model provenance.
This does not change model/API inference contracts or introduce backend persistence.
No account/device synchronization or immediate retraining is implemented.
Unsupported predictions remain unavailable; numeric comparisons require explicit
scale/protocol confirmation. See [workflow details](CANDIDATE_VALIDATION_WORKFLOW.md).

## Unified backend — implemented contract (2026-09-18)

Entrypoint: `backend.main:app`, run from repository root. Example local base URL:
`http://127.0.0.1:8001`. This local address is not an internet deployment.

| Endpoint | Request / output |
|---|---|
| `GET /health` | HTTP liveness only; does not load either model |
| `GET /ready` | Actual artifact inference on initial load; per-engine readiness/version; 503 if either unavailable |
| `GET /formulas` | Existing stable shampoo catalog, pagination and additional `catalog_version` |
| `POST /reformulate` | Existing rescue request/response plus `model_version` and `catalog_version` |
| `GET /ai-reformulation/products` | Versioned catalog: brand, product, category, three synthetic factors with ranges/baseline |
| `POST /ai-reformulation/predict` | Required `product_id` and exactly three factor percentages; selected product, four predictions, version, provenance, disclaimer |
| `POST /ai-reformulation/optimize` | Baseline, numerical targets and optional locks/bounds; at most three predicted-feasible alternatives |

AI composition fields: `factor_a_pct`, `factor_b_pct`, `factor_c_pct`.
Their labels, ranges and synthetic baselines come from the selected catalog profile.
Values must be finite JSON numbers, not strings or booleans. Unknown products are rejected.
Category is derived server-side from `product_id`, not accepted as a client override.
These are illustrative formulation roles, not a complete 100% formula or manufacturer recipe.

Prediction fixture:

```json
{"product_id":"wardah-lightening-day-cream","composition":{"factor_a_pct":4.0,"factor_b_pct":8.0,"factor_c_pct":2.2}}
```

Optimizer fixture:

```json
{
  "product_id":"wardah-lightening-day-cream",
  "baseline":{"factor_a_pct":4.0,"factor_b_pct":8.0,"factor_c_pct":2.2},
  "target_constraints":{"hydration_ratio_min":1.25,"stickiness_score_0_10_max":4.5},
  "bounds":{"factor_b_pct":{"min":6.0,"max":15.0}},
  "fixed":["factor_c_pct"],
  "top_k":3,
  "seed":42,
  "min_distance":0.03
}
```

Supported target keys: each name from `hydration_ratio`,
`stickiness_score_0_10`, `oiliness_score_0_10`, `consistency_index`, suffixed
with `_min` or `_max`. At least one is required, at most eight. Values are
nonnegative, finite, at most 1,000,000; sensory score thresholds are at most 10.
Contradictory min/max is rejected. Impossible but structurally valid targets
are allowed and can produce an empty search.

`bounds` must be inside the selected synthetic product profile ranges and contain the baseline value. `fixed`
contains unique supported factor names. A fixed factor stays at its baseline;
equal min/max bounds also lock a factor. `top_k`: integer 1–3; `seed`: integer
0–4,294,967,295; `min_distance`: finite number 0–0.5. Unknown fields are rejected.

Optimizer response fields: `mode`, `status`, `model_version`, `data_origin`,
`product`, `baseline`, `target_constraints`, `fixed`, `effective_bounds`, `process`,
`candidates`, `limitations`, `disclaimer`. Each candidate includes a deterministic
`candidate_id`, `rank`, `composition`, `predicted_responses`, composition/response
deltas, `normalized_change_distance`, target checks and `PREDICTED_FEASIBLE` status.
The candidate ID is not a persisted experiment ID. There is no session storage yet.

The backend samples 10,000 points, predicts in a batch, removes invalid outputs,
excludes the baseline and filters all targets at full numerical precision. Ranking:
normalized composition distance ascending, hydration descending, stickiness ascending.
It then applies pairwise diversity distance and returns **up to** `top_k` candidates.
All-locked input produces no alternatives. Empty result: HTTP 200,
`NO_FEASIBLE_ALTERNATIVE_FOUND`, `candidates: []`; this is not proof of global infeasibility.
Per-target pass counts are independent counts, not sequential funnel counts.
No confidence percentage or laboratory-success probability is supplied for this regression.

Safety/error contract: JSON only; backend body limit 16 KiB (including chunks);
422 invalid schema/domain/predicted physical bounds; 413 oversized;
415 incorrect content type; 503 missing/incompatible model; generic 500 unexpected failure.
429 means both optimizer execution slots in this process are occupied, **not**
a distributed or per-user rate limit. No authentication or request deadline middleware.
Production rate limiting/timeouts must be reviewed separately.

Every AI result includes: `Predicted / estimated and requires physical laboratory validation.`
The current sensory data provenance is `SYNTHETIC_PROTOTYPE_DATA`; model metrics describe held-out synthetic interpolation, not laboratory accuracy. The previous Mercurio artifact remains preserved but is not the current API model.
CORS uses exact comma-separated `CORS_ORIGINS`; defaults allow localhost:3000 and
127.0.0.1:3000. No wildcard credentials. CORS is not authentication.

Frontend checkpoint: Formula Rescue and AI Reformulation use same-origin Next.js
Route Handlers. In Services, both use the runtime `SPONTAN_BACKEND_URL` binding.
The AI proxy only permits GET `products` and POST `predict` / `optimize`, validates JSON/media/body size,
does not forward browser cookies and fails closed without unified-backend config.
The frontend displays real baseline/Top 3/empty search/process/evidence and never
substitutes fabricated predictions. Successful responses are retained only in
browser memory for the dashboard/library. Lab feedback can be downloaded as JSON;
neither sessions nor lab results are persisted by the backend.
No current public deployment was changed.

The generic template below is retained for future team decisions; its TBD fields
do not override this implemented contract.

## Formula Rescue integration — implemented checkpoint

Bagian ini menjelaskan proxy frontend existing; backend gabungan dijelaskan di atas.
Formula Rescue memakai kontrak existing dari Hackathon/backend/schemas.py.

- Browser: GET /api/formula-rescue/formulas?offset=0&limit=100.
- Browser: POST /api/formula-rescue/reformulate.
- Next.js meneruskan ke GET /formulas dan POST /reformulate pada backend yang
  dipilih server-side; binding Services memprioritaskan unified backend.
- GET /api/formula-rescue/health hanya memeriksa HTTP, bukan readiness model.
- Upstream Services: binding runtime `SPONTAN_BACKEND_URL`; override lokal/legacy:
  `FORMULARESCUE_API_URL`. Fallback Rescue-only lama hanya untuk non-Vercel.
- Request: formula_id integer, constraint.type = ingredient_unavailable,
  constraint.ingredient string 1–200 karakter, top_k integer 1–10 (UI meminta 8).
- Fixture: formula_id 7, ingredient Plantacare 818 -> Top 3: 288, 292, 190.
- Response dan satuan tetap sama dengan API lama; ranking score bukan probability.
- Penghubung tidak menerima URL tujuan dari pengguna, tidak meneruskan cookie/token,
  dan tidak melakukan retraining atau penyimpanan riwayat.
- 422 input tidak valid; 413 payload lebih dari 8 KiB; 415 content type bukan JSON;
  429 bila upstream membatasi; 502 respons/upstream error; 503 unavailable/timeout.
- Ini bukan kontrak API AI Reformulation atau autentikasi.

## Proposed minimal endpoints (change for the actual case)

| Endpoint | Purpose |
|---|---|
| GET /health | HTTP process alive; does not imply model ready |
| GET /ready | Predictor/preprocessing/artifacts load successfully; return 503 if not ready |
| POST /predict | Validate input, call predictor, return versioned result |

Actual list and field names: TBD. Do not automatically build extra endpoints.

## Input

| Field | Type | Unit/range/length | Required | Meaning |
|---|---|---|---|---|
| TBD | TBD | TBD | TBD | TBD |

One request fixture: TBD. It must match MODEL_CONTRACT.md. Agree whether preprocessing runs in backend or supplied pipeline; do not duplicate it in frontend.

## Output

| Field | Type | Meaning |
|---|---|---|
| TBD | TBD | TBD |
| model_version (proposed) | string | Exact artifact version used |
| disclaimer (proposed) | string | Agreed limitation notice |

One successful response fixture: TBD. Define probability vs ranking score vs regression value precisely. Do not call an uncalibrated ranking score a confidence probability.

## Errors

- 422: invalid user input; explain safe validation detail.
- 503: model/predictor unavailable; do not return a fabricated result.
- 500: unexpected server failure; generic client message, internal sanitized log.
- 429: too many requests, once rate limiting is configured.
- Empty valid result: define case-specific behavior here: TBD.

Payload limit: TBD. String/array/image limits: TBD. Request timeout: TBD. Rate policy: TBD.

## Integration

- Backend HTTPS base URL: TBD
- Frontend production origin for CORS: TBD
- Frontend public setting: NEXT_PUBLIC_API_BASE_URL (URL only, never credentials)
- API routes are appended to base URL; do not store /docs in the base URL.
- TypeScript types and Pydantic schemas must agree on fields, nullability, and units.

## Acceptance

- [ ] Owner/reviewer agree request and response fixtures.
- [ ] Mock response has a visible mock label.
- [ ] Valid fixture succeeds locally and on public backend.
- [ ] Invalid fixture returns controlled status/detail.
- [ ] Browser from actual frontend origin passes CORS.
