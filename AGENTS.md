# Hackathon Agent Instructions

## Scope and source of truth

- This is a reusable, separate hackathon starter, not the FormulaRescue application.
- Read PROJECT_SPEC.md first for a new implementation; TBD means unknown, not permission to invent requirements.
- Read only relevant sections of docs/TEAM_CONTRACT.md, docs/API_CONTRACT.md, and docs/MODEL_CONTRACT.md.
- Follow nested backend/AGENTS.md, frontend/AGENTS.md, and ml/AGENTS.md when working in those areas.
- Do not generate the whole application at once. Implement only the requested checkpoint, verify, explain, then stop.
- Do not add databases, authentication, Docker, LLM/RAG, external paid APIs, or infrastructure unless the agreed case needs them and the user authorizes them.

## Efficiency and teamwork

- Start with git status --short. Use rg for targeted inspection; preserve existing changes.
- Work on the agreed task branch. Do not force-push, merge, deploy, expose endpoints, or retrain unless requested.
- Changes to shared API/model contracts require team agreement before changing consumers.
- Avoid reinstalling packages or retraining for unrelated UI/API tasks.
- Never move, delete, or recreate .git to bypass tooling problems. Stop and report the blocker instead.
- Do not spawn agents unless explicitly requested.

## Validation and safety

- Use mock results only when clearly labeled; never present mock metrics as training evidence.
- Record unseen-data evaluation, limitations, and model version. Scores are not guaranteed outcomes.
- Readiness must verify model/preprocessing loading; health alone checks HTTP liveness.
- Match clean runtime dependencies to actual imports and model wrappers; document versions and lock dependencies when tooling is selected.
- Keep secrets, large/private datasets, caches, and generated builds out of Git. NEXT_PUBLIC_ is never a secret.
- CORS is not authentication. Review input bounds, rate limits, cost alerts, HTTPS, logs, and public data exposure before wider sharing.
- Do not expose tracebacks, filesystem paths, or secrets in client-facing error responses.
- Tests: docs/config -> diff check + format validation; backend/model -> tests + one prediction; frontend -> typecheck/build; integration -> all relevant tests + real HTTP requests.

## Communication

- Use compact beginner-friendly Indonesian. Explain new concepts and where commands run.
- Give 1-3 small actions per checkpoint and wait for results.
- Handoff: outcome, files changed, tests, known limits, next boundary. Distinguish verified facts from hypotheses.
