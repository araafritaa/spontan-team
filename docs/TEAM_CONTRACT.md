# Team Working Contract

Fill together. This is an operational agreement, not a legal contract.

## People and ownership

| Area | Primary owner | Reviewer/backup |
|---|---|---|
| Dataset + Cloudeka training | TBD | TBD |
| Model handover + predictor | TBD | TBD |
| Backend + deployment | TBD | TBD |
| Frontend + integration | TBD | TBD |
| Pitch + submission | TBD | TBD |

GitHub usernames: TBD / TBD. Communication channel: TBD.

Primary owner coordinates changes; it does not prohibit the other member contributing. Announce before touching a shared file.

## Shared contract rule

Before parallel coding, agree API input/output, units, label meaning, error behavior, and one fixture in API_CONTRACT.md and MODEL_CONTRACT.md. If a contract changes, notify the other member, update fixture/version, then update both sides. Never silently rename fields.

## Git workflow

- main = latest demonstrable version; no deliberate broken commits.
- Branches: feat/frontend, feat/backend, feat/model (one active owner per branch).
- Commit small changes with clear messages; no secrets or large private data.
- Push task branch -> pull request -> quick review -> merge -> both pull main.
- If reviewer unavailable: explicitly agree self-merge rules here: TBD.
- No force-push, shared account/password, or unresolved merge conflicts in main.
- Freeze risky dependency/model changes after hour: TBD.

## 24-hour plan

| Hours | Checkpoint |
|---|---|
| 0-2 | Rules/data checked, one MVP flow, contracts agreed |
| 2-6 | Baseline in Cloudeka; UI/API mock clearly labeled |
| 6-10 | Handover + real local integration |
| 10-14 | Public deployment if allowed; real prediction smoke test |
| 14-18 | Highest-impact model/UI fixes only |
| 18-21 | Feature freeze, input/resource/error tests |
| 21-24 | Pitch rehearsal, video fallback, submission |

Sync interval: TBD (suggestion: short checkpoint every two hours). Break schedule: TBD.

## Handoff message template

```text
Task / branch / commit:
What works:
Files/contracts changed:
Test run and output:
How to reproduce:
Known failures/limitations:
Next owner and next action:
```

## Decision rule

If blocked, share exact error and last working state. Fix the observed cause first. Prefer a simple baseline end-to-end over unintegrated sophisticated features. Confirm dataset/model/code reuse and attribution against event rules.
