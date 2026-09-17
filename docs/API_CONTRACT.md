# API Contract — Agree Before Parallel Coding

Status: unified local backend implemented, version 0.1.0. Deployment and new AI frontend wiring are not completed. Team owner/reviewer: TBD.

## Unified backend — implemented contract (2026-09-17)

Entrypoint: `backend.main:app`, run from repository root. Example local base URL:
`http://127.0.0.1:8001`. This local address is not an internet deployment.

| Endpoint | Request / output |
|---|---|
| `GET /health` | HTTP liveness only; does not load either model |
| `GET /ready` | Actual artifact inference on initial load; per-engine readiness/version; 503 if either unavailable |
| `GET /formulas` | Existing stable shampoo catalog, pagination and additional `catalog_version` |
| `POST /reformulate` | Existing rescue request/response plus `model_version` and `catalog_version` |
| `POST /ai-reformulation/predict` | `composition` with exactly the three study factors; four predicted responses, version, provenance, disclaimer |
| `POST /ai-reformulation/optimize` | Baseline, numerical targets and optional locks/bounds; at most three predicted-feasible alternatives |

AI composition fields: `phytantriol_pct` 0–3%, `soy_lecithin_pct` 0–3%,
`cct_pct` 0–5%. Values must be finite JSON numbers, not strings or booleans.
These are factors in the Mercurio emulsion study, not a complete 100% formula.

Prediction fixture:

```json
{"composition":{"phytantriol_pct":1.5,"soy_lecithin_pct":2.5,"cct_pct":3.0}}
```

Optimizer fixture:

```json
{
  "baseline":{"phytantriol_pct":1.5,"soy_lecithin_pct":2.5,"cct_pct":3.0},
  "target_constraints":{"hydration_ratio_min":1.55,"stickiness_score_0_10_max":3.5},
  "bounds":{"soy_lecithin_pct":{"min":2.0,"max":3.0}},
  "fixed":["cct_pct"],
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

`bounds` must be inside study ranges and contain the baseline value. `fixed`
contains unique supported factor names. A fixed factor stays at its baseline;
equal min/max bounds also lock a factor. `top_k`: integer 1–3; `seed`: integer
0–4,294,967,295; `min_distance`: finite number 0–0.5. Unknown fields are rejected.

Optimizer response fields: `mode`, `status`, `model_version`, `data_origin`,
`baseline`, `target_constraints`, `fixed`, `effective_bounds`, `process`,
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
The sensory data provenance remains `MODEL_GENERATED_PUBLISHED_EQUATION`.
CORS uses exact comma-separated `CORS_ORIGINS`; defaults allow localhost:3000 and
127.0.0.1:3000. No wildcard credentials. CORS is not authentication.

Frontend checkpoint: existing Formula Rescue proxy can point to this backend via
server-side `FORMULARESCUE_API_URL`. It still defaults to the old public API.
AI Reformulation wizard is **not connected** to these endpoints in this backend stage.
No current public deployment was changed.

The generic template below is retained for future team decisions; its TBD fields
do not override this implemented contract.

## Formula Rescue integration — implemented checkpoint

Bagian ini menjelaskan proxy frontend existing; backend gabungan dijelaskan di atas.
Formula Rescue memakai kontrak existing dari Hackathon/backend/schemas.py.

- Browser: GET /api/formula-rescue/formulas?offset=0&limit=100.
- Browser: POST /api/formula-rescue/reformulate.
- Next.js meneruskan ke GET /formulas dan POST /reformulate di API lama.
- GET /api/formula-rescue/health hanya memeriksa HTTP, bukan readiness model.
- Upstream server env: FORMULARESCUE_API_URL; default backend Vercel lama.
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
