# FastAPI Backend Instructions

Inherit root AGENTS.md. Read docs/API_CONTRACT.md and docs/MODEL_CONTRACT.md before changing schemas/predictor.

- Stack default: Python + FastAPI, simple modules (main, schemas, predictor) only when implementation requested.
- Backend owns validation, preprocessing integration, domain logic, and prediction. Do not duplicate model logic in frontend.
- Build one endpoint at a time using agreed fixtures. Keep mock vs real behavior explicit.
- Validate types, ranges, finite numbers, string/array/body limits, and agreed units. Never accept arbitrary artifact paths or user code.
- Health = HTTP liveness. Readiness must confirm actual artifact/preprocessing load; unavailable model returns controlled 503, not fake prediction.
- Load trusted model once per runtime instance; do not retrain per request. Cache is per instance and is not distributed rate limiting.
- Record runtime dependencies including wrapper requirements; avoid GPU/training-only packages for CPU serving. Check clean runtime, not just global laptop packages.
- Use exact environment-configured CORS origins. No wildcard credentials. CORS is not authentication.
- Keep secrets server-side. Log unexpected failures internally without secret/input leaks; client receives generic 500 and agreed error schema.
- Data/model artifacts read-only. Do not add persistence unless required by PROJECT_SPEC.
- Before deployment, verify entrypoint, artifact inclusion glob schema, resource limits, and current provider docs. Vercel hosting is not guaranteed for every model.
- Verify tests: valid fixture, invalid bounds/domain input, missing artifact, readiness failure, CORS, model version, and one actual HTTP prediction.
- If adding dependencies, check advisory/compatibility and lock mechanism; do not claim secure without scoped evidence.
