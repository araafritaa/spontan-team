# Demo and Deployment Checklist

Status: not verified. Fill with actual evidence, not checkmarks from assumptions.

## Before coding

- [ ] Event permits starter, assistant, dataset/model reuse, and Vercel.
- [ ] TEAM_CONTRACT, API_CONTRACT, MODEL_CONTRACT agreed.
- [ ] One concrete user flow and demo fixture chosen.

## Cloudeka and handover

- [ ] Baseline trained/evaluated on unseen data in required environment.
- [ ] No train/test leakage; metric meaning/limits documented.
- [ ] CPU inference or suitable serving environment confirmed.
- [ ] Model/preprocessing/metadata/fixtures transferred securely.
- [ ] Trusted artifact loads and predicts in clean runtime, not only trainer's notebook.

## Runtime and deployment

- [ ] Runtime dependencies explicit/locked, including wrapper dependencies.
- [ ] Entry point and supported Python/Node versions verified.
- [ ] No training, GPU-only dependencies, or unnecessary data in inference bundle.
- [ ] Required artifacts explicitly bundled; schema validation checked against current provider docs.
- [ ] GET health, GET readiness, valid prediction, invalid prediction tested locally/publicly.
- [ ] Startup failures logged safely; no internal traces or secrets returned to users.
- [ ] Frontend uses correct HTTPS API base; NEXT_PUBLIC_ holds no secrets.
- [ ] CORS uses exact frontend origin; CORS is not access control.
- [ ] Resource budget, rate policy, maximum input length/body size, timeout, monitoring and usage alerts reviewed.
- [ ] Public dataset/results are allowed to be exposed; confidential formulas/data need a different access design.
- [ ] Real browser flow tested on another device/network; HTTP checks alone do not prove UI works.
- [ ] Demo does not depend on trainer's laptop/tunnel if permanent hosting is required.

## Submission

- [ ] Source/model/data attribution and limitations included.
- [ ] Demo links verified without developer-only login if judges need public access.
- [ ] Pitch: problem -> user flow -> AI evidence -> benefit -> limits -> next steps.
- [ ] Screen-recorded fallback and known-input fixture ready.
- [ ] Teammate can reproduce setup; final submission before deadline.

Evidence log: time, commit, environment, request/test, result, unresolved issue: TBD.
