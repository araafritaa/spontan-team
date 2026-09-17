# Cloudeka Training Instructions

Inherit root AGENTS.md; read docs/MODEL_CONTRACT.md before preprocessing/training.

- Train only when requested and in the environment required by organizer. Keep verifiable evidence within event/privacy rules.
- Start with simple baseline and realistic unseen-data evaluation, not maximum complexity.
- Split before fitting preprocessing; avoid group/time/duplicate leakage relevant to case.
- Document feature order, units, missing values, labels, threshold, preprocessing, seed, library versions, and evaluation.
- Confirm CPU inference compatibility before promising Vercel serving. GPU training is not GPU serving.
- Export trusted model + preprocessing + metadata + metrics + a prediction fixture as one coherent handover.
- Keep notebooks/source reproducible; remove secrets and sensitive outputs before Git.
- Never present full-training inference or mock metrics as holdout performance.
- Receiver must load artifacts in clean deployment-like environment and check prediction tolerance. Coordinate interface changes with backend owner.
