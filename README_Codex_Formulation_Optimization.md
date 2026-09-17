# Consumer-Guided Formulation Optimization Platform
## README for Codex / AI Coding Agents

> **Purpose of this README:** give coding agents enough product, data, frontend, backend, and AI-system context to work independently without misinterpreting the product.

---

# 1. Product Summary

We are building an **AI-assisted cosmetic R&D optimization platform**.

The platform is used by **R&D/formulation teams** after the marketing/consumer-insight team has already collected and cleaned customer feedback.

The system does **not** generate a cosmetic formula from scratch.

Instead, it starts from an **existing product with an existing formulation and process**, then helps R&D decide:

> **Which existing ingredient concentrations, ratios, or manufacturing-process settings should be adjusted to address a validated consumer insight?**

Example:

```text
Existing product:
Vitamin C Cream

Marketing insight:
"Brightening is good, but the product feels dry/tight
and is not moisturizing enough."

R&D goal:
Preserve brightening
Improve hydration
Reduce dry/tight after-feel
Avoid excessive stickiness/oiliness
Maintain acceptable stability

Platform output:
Ranked formulation/process adjustments for physical lab testing.
```

The output is always a **recommended experiment**, not a guaranteed final formula.

---

# 2. Primary User

## Main user

```text
Cosmetic R&D / Formulation Scientist
```

The marketing team is upstream of the platform.

Marketing provides R&D with a **clean product insight**.

The R&D user then enters the insight into this platform together with the existing product/formulation information.

---

# 3. End-to-End Product Flow

```text
MARKETING / CONSUMER INSIGHT
        │
        │ Clean insight already prepared
        ▼
R&D USER
        │
        │ Inputs:
        │ - Product name
        │ - Clean insight
        │ - Current formulation
        │ - Current process settings
        │ - Optional current measured properties
        │ - Constraints
        ▼
INSIGHT TRANSLATION ENGINE
        │
        │ Example:
        │ "dry / tight"
        │     ↓
        │ hydration ↑
        │ dry-feel/friction ↓
        │
        │ "brightening is good"
        │     ↓
        │ preserve brightening-related system
        ▼
REFORMULATION / OPTIMIZATION ENGINE
        │
        │ Searches:
        │ - concentration changes
        │ - ratio changes
        │ - process-setting changes
        ▼
FORWARD PREDICTION
        │
        │ Predict:
        │ hydration
        │ stickiness
        │ oiliness
        │ viscosity
        │ consistency
        │ stability-related properties
        │ etc.
        ▼
CANDIDATE RANKING
        │
        ├── Candidate 1
        ├── Candidate 2
        └── Candidate 3
        ▼
R&D PHYSICAL VALIDATION
        │
        │ Prototype is made in lab
        │ Actual outputs are measured
        ▼
LAB RESULT
        │
        ├── accepted
        └── rejected
        ▼
EXPERIMENTAL DATASET
        │
        └──────────────→ future model improvement
```

---

# 4. MVP Scope

The MVP is intentionally constrained.

## Ingredient identities remain fixed

For the first version:

```text
DO NOT:
replace Ingredient A with Ingredient B
introduce random new ingredients
generate an entirely new formula
```

Allowed optimization variables:

### Composition

```text
ingredient concentration
ingredient ratio
```

Example:

```text
Humectant:
4.0% → 5.0%

Emollient:
10.0% → 11.5%

Polymer:
0.40% → 0.32%
```

### Process

```text
homogenization speed
mixing speed
mixing duration
addition temperature
cooling conditions
other existing process settings
```

Example:

```text
Homogenization:
3000 rpm → 4200 rpm

Temperature:
70 °C → 65 °C

Mixing time:
5 min → 7 min
```

---

# 5. Product Principle

The system must be framed as:

> **AI-guided experimental design for existing formulations**

NOT:

> AI magically reformulates a product.

The system recommends:

```text
what to test next
```

The laboratory determines:

```text
what actually works
```

---

# 6. Required R&D Input

The frontend should collect the following.

## A. Product information

Required:

```text
product_name
product_category
```

Optional:

```text
brand
product_version
description
```

---

## B. Clean consumer insight

Required:

```text
insight_text
```

Example:

```text
"Consumers like the brightening performance,
but the product feels dry/tight and lacks moisturization."
```

Optional structured fields:

```text
strengths_to_preserve[]
pain_points_to_improve[]
```

---

## C. Current formulation

R&D should provide the existing ingredient list.

Suggested structure:

```json
[
  {
    "ingredient_name": "Ingredient A",
    "role": "humectant",
    "concentration_pct": 4.0,
    "is_adjustable": true,
    "min_pct": 2.0,
    "max_pct": 6.0
  }
]
```

Important:

```text
ingredient_name
ingredient_role
current concentration
whether adjustable
allowed min/max range
```

---

## D. Current process settings

Example:

```json
{
  "mixing_speed_rpm": 1000,
  "homogenization_speed_rpm": 3000,
  "mixing_time_min": 5,
  "temperature_c": 70,
  "cooling_rate_c_min": null
}
```

Each process variable should ideally include:

```text
current value
adjustable?
min value
max value
unit
```

---

## E. Current measured properties

Optional for MVP but highly valuable.

Example:

```json
{
  "pH": 5.2,
  "viscosity": 5200,
  "hydration_score": null,
  "stickiness_score": null,
  "stability_status": "PASS"
}
```

These become the baseline for:

```text
predicted delta vs current product
```

---

## F. Constraints

Examples:

```text
active concentration must remain fixed
pH must stay between 5.0 and 5.5
viscosity must stay in range
stability must remain PASS
ingredient identities cannot change
cost constraint optional
```

---

# 7. AI System Responsibilities

The system should be separated into clear modules.

---

## Module 1 — Insight Translator

### Input

```text
clean consumer insight
```

### Output

Structured technical objective.

Example:

```json
{
  "preserve": [
    {
      "attribute": "brightening",
      "reason": "positive consumer feedback"
    }
  ],
  "improve": [
    {
      "attribute": "hydration",
      "direction": "increase"
    },
    {
      "attribute": "dry_tight_afterfeel",
      "direction": "decrease"
    }
  ],
  "watch": [
    "stickiness",
    "oiliness",
    "stability"
  ]
}
```

Important:

The Insight Translator does **not** directly decide the concentration change.

It only converts consumer language into technical targets.

---

## Module 2 — Forward Formulation Model

Question:

> If we use this composition/process setting, what properties are expected?

Conceptually:

```text
composition
+
process
+
product context
        ↓
predicted responses
```

Example:

```json
{
  "predicted_hydration": 1.57,
  "predicted_stickiness": 2.8,
  "predicted_oiliness": 2.5,
  "predicted_consistency": 28500
}
```

---

## Module 3 — Optimizer / Candidate Generator

Question:

> Which allowable formulation/process settings best satisfy the technical objective?

Example objective:

```text
maximize hydration

minimize stickiness

subject to:
oiliness <= limit
consistency inside acceptable range
ingredient identities fixed
concentrations inside min/max
process parameters inside allowed range
```

The optimizer should generate multiple candidates, not one "magic answer".

Recommended MVP:

```text
Top 3 candidates
```

---

## Module 4 — Explanation / Evidence Layer

Every candidate should explain:

```text
what changed
why it was suggested
predicted impact
source relation / model used
valid design range
evidence quality
limitations
required lab validation
```

Example:

```json
{
  "candidate_id": "CAND-01",
  "changes": [
    {
      "variable": "soy_lecithin_pct",
      "from": 1.5,
      "to": 2.1
    }
  ],
  "predicted_impact": {
    "hydration": "increase",
    "stickiness": "within target"
  },
  "evidence": [
    "MER-01",
    "MER-02"
  ],
  "requires_lab_validation": true
}
```

---

# 8. Dataset Context

Current prototype dataset:

```text
Phase2_500_Prototype_Training_Dataset.xlsx
```

Dataset composition:

```text
500 total rows

42 measured experimental rows
458 model-generated rows

488 composition-focused rows
12 process-focused rows
```

Important:

> **500 rows does NOT mean 500 independent experiments.**

The 458 generated rows are created from response-surface equations published in peer-reviewed studies.

They are useful for:

```text
prototype model training
optimizer development
pipeline development
UI demo
feature engineering
```

They must not be represented as:

```text
458 new lab experiments
```

---

# 9. Main Literature Blocks

## Mercurio

Best match to the consumer-insight use case.

Inputs:

```text
Phytantriol %
Soy lecithin %
Caprylic/capric triglycerides %
```

Outputs:

```text
hydration
stickiness
oiliness
consistency
```

Use for:

```text
sensory / hydration composition optimization
```

---

## Oliveira

Inputs:

```text
SLS %
Beeswax %
Macadamia oil %
```

Outputs:

```text
pH
viscosity
adhesiveness
```

Use for:

```text
cream physical-property composition optimization
```

---

## Anicescu

Inputs:

```text
Tween80/PG %
Lecithin %
Oat oil %
```

Outputs:

```text
viscosity
droplet size
work of adhesion
```

Use for:

```text
microstructure / physical-property optimization
```

---

## Chow

Composition fixed.

Inputs:

```text
homogenization speed
addition temperature
mixing duration
final homogenization
```

Outputs:

```text
stability
rheology
firmness
spreadability
friction
```

Use for:

```text
process optimization
```

---

# 10. Evidence Rules

Every model/recommendation must preserve provenance.

Useful fields:

```text
study_id
source_doi
source_url
data_origin
is_empirical_ground_truth
generation_method
valid_factor_range
relation_id
```

Possible evidence types:

```text
MEASURED

PUBLISHED_MODEL

MODEL_GENERATED_PUBLISHED_EQUATION
```

Never silently mix them.

---

# 11. Important AI Safety / Scientific Constraints

The system must never imply:

```text
"this reformulation will definitely work"
```

Preferred language:

```text
"predicted candidate for lab validation"
```

Do not extrapolate outside the validated design space.

Example:

```text
source studied:
0–3%

DO NOT recommend:
8%
```

unless a future company-specific model explicitly supports it.

Do not apply one paper's relation universally across unrelated formulation systems.

Example:

```text
Mercurio emulsion relation
≠
universal rule for every cosmetic cream
```

---

# 12. Recommended Backend Architecture

A simple MVP architecture is enough.

```text
Frontend
React / Next.js
        │
        ▼
Backend API
FastAPI or Node/NestJS
        │
        ├── Product/Formulation Service
        ├── Insight Translation Service
        ├── Prediction Service
        ├── Optimization Service
        ├── Recommendation Service
        └── Experiment Result Service
        │
        ▼
PostgreSQL
        │
        ├── products
        ├── formulations
        ├── formulation_ingredients
        ├── process_settings
        ├── insights
        ├── optimization_runs
        ├── candidates
        ├── experiment_results
        └── evidence_sources
```

For hackathon/MVP, fewer tables are acceptable if implementation speed is more important.

---

# 13. Suggested Database Schema

## products

```text
id
name
category
version
created_at
```

## insights

```text
id
product_id
raw_or_clean_text
structured_targets_json
created_at
```

## formulations

```text
id
product_id
version
is_current
created_at
```

## formulation_ingredients

```text
id
formulation_id
ingredient_name
ingredient_role
concentration_pct
is_adjustable
min_pct
max_pct
```

## process_settings

```text
id
formulation_id
parameter_name
value
unit
is_adjustable
min_value
max_value
```

## optimization_runs

```text
id
product_id
formulation_id
insight_id
status
created_at
```

## candidates

```text
id
optimization_run_id
rank
changes_json
predicted_outputs_json
evidence_json
score
```

## experiment_results

```text
id
candidate_id
actual_outputs_json
status
notes
created_at
```

---

# 14. Suggested Backend API

Exact route naming can change, but preserve these capabilities.

## Product

```http
POST /products
GET  /products
GET  /products/{id}
```

## Current formulation

```http
POST /products/{id}/formulation
GET  /products/{id}/formulation
```

## Insight

```http
POST /products/{id}/insights
POST /insights/{id}/translate
```

## Optimization

```http
POST /optimization-runs
GET  /optimization-runs/{id}
```

Suggested request:

```json
{
  "product_id": "uuid",
  "insight_id": "uuid",
  "formulation_id": "uuid",
  "candidate_count": 3
}
```

Suggested result:

```json
{
  "run_id": "uuid",
  "technical_objective": {},
  "candidates": []
}
```

## Physical validation

```http
POST /candidates/{id}/experiment-result
```

---

# 15. Frontend Pages

Keep the MVP user flow very simple.

---

## Page 1 — Dashboard

Show:

```text
Products
Recent optimization runs
Recent lab validations
```

Primary CTA:

```text
New Optimization
```

---

## Page 2 — New Optimization

Suggested steps:

### Step 1 — Product

```text
Select existing product
or create product
```

### Step 2 — Insight

```text
Paste clean marketing insight
```

### Step 3 — Current formulation

Editable table:

| Ingredient | Role | Current % | Adjustable? | Min | Max |
|---|---|---:|---|---:|---:|

### Step 4 — Process

Editable table:

| Parameter | Current | Unit | Adjustable? | Min | Max |
|---|---:|---|---|---:|---:|

### Step 5 — Constraints

Examples:

```text
preserve active concentration
pH limits
viscosity range
```

CTA:

```text
Generate Recommendations
```

---

## Page 3 — Recommendation Results

Show technical objective first.

Example:

```text
Preserve:
Brightening

Improve:
Hydration ↑
Dry/tight after-feel ↓

Watch:
Stickiness
Oiliness
Stability
```

Then display Top 3 candidate cards.

Each candidate should show:

```text
Changes
Predicted impact
Trade-offs
Evidence
Confidence / data origin
Validation tests required
```

---

## Page 4 — Candidate Detail

Show:

```text
Current vs proposed formulation
Current vs proposed process
Predicted responses
Why candidate was selected
Evidence relations
Valid ranges
```

CTA:

```text
Send to Lab Validation
```

---

## Page 5 — Physical Validation

R&D inputs actual test results.

Example:

```text
hydration
stickiness
viscosity
stability
notes
accepted / rejected
```

After submission:

```text
save as MEASURED experiment
```

---

# 16. Recommendation Ranking

Do not hard-code a universal ranking formula yet.

For MVP, a candidate score can conceptually combine:

```text
target improvement
constraint compliance
distance from current formula
evidence confidence
```

Example:

```text
higher predicted target improvement = better

smaller concentration/process change = preferred

constraint violation = reject

outside validated evidence range = reject
```

The ranking system should be transparent.

---

# 17. Important Design Choice: Minimal Change

Because this system improves an existing successful product, prefer:

```text
minimum required formulation/process change
```

over:

```text
maximum possible property change
```

Conceptually:

```text
maximize desired improvement

while minimizing:
distance from current formula
number of changed variables
risk
```

This should influence candidate ranking.

---

# 18. AI / ML Implementation Recommendation for MVP

Do not start by building one huge deep-learning model.

The dataset is tabular and small.

Better initial options:

```text
published response equations directly
Gaussian Process
Random Forest
XGBoost
polynomial response-surface models
```

For Mercurio/Oliveira/Anicescu data, using the published equations directly is acceptable for an MVP because synthetic rows were generated from those same equations.

Do not train/test a model on the generated rows and claim high scientific accuracy.

---

# 19. Optimization Implementation

A simple MVP optimizer can:

```text
1. generate many candidate combinations inside allowed ranges
2. predict outputs
3. remove constraint violations
4. calculate objective score
5. calculate distance from current formula
6. rank candidates
7. return Top 3
```

Candidate generation options:

```text
grid search
random search
Latin Hypercube Sampling
Bayesian optimization later
```

---

# 20. Example Optimization Logic

Current formula:

```text
A = 1.5%
B = 2.5%
C = 1.5%
```

Target:

```text
hydration ↑
stickiness ≤ 3
oiliness ≤ 3
```

Generate candidate:

```text
A = 1.8%
B = 3.0%
C = 1.2%
```

Forward prediction:

```text
hydration = 1.57
stickiness = 2.8
oiliness = 2.5
```

Constraint check:

```text
PASS
```

Distance from baseline:

```text
small
```

Candidate score:

```text
high
```

Return as one of Top 3.

---

# 21. Physical Validation Loop

This feature is important and should be built from the beginning.

The UI should allow R&D to submit:

```text
candidate tested
actual measured properties
accepted/rejected
notes
```

Store this permanently.

Future logic:

```text
predicted vs actual error
        ↓
model evaluation
        ↓
future retraining
```

---

# 22. What Is NOT in MVP

Do not implement unless specifically requested.

```text
raw social-media scraping
marketing review mining
supplier substitution
ingredient replacement
full regulatory engine
automatic safety approval
automatic claim approval
fully autonomous laboratory
production deployment of a general foundation model
```

The marketing insight is currently assumed to be **already cleaned** before R&D uses the platform.

---

# 23. Expected Agent Behavior

When working on this repository, coding agents should:

1. Preserve the core workflow:
   ```text
   insight → technical target → optimization → candidate → lab validation
   ```

2. Never redesign the product as a generic cosmetic-formulation generator.

3. Keep **current formulation** and **current process** as required optimization context.

4. Keep ingredient identities fixed for MVP.

5. Preserve provenance/evidence fields.

6. Distinguish:
   ```text
   measured data
   vs
   model-generated data
   ```

7. Treat AI output as:
   ```text
   candidate experiment
   ```
   not a validated final formulation.

8. Prefer small, modular, explainable implementations.

9. Do not silently introduce unsupported scientific rules.

10. When changing schema/API behavior, update this README.

---

# 24. Suggested Repository Structure

Example only; agents may adapt if the existing repository differs.

```text
/
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── services/
│   └── types/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   │   ├── insight/
│   │   │   ├── prediction/
│   │   │   ├── optimization/
│   │   │   └── evidence/
│   │   └── db/
│   └── tests/
│
├── data/
│   ├── Phase2_500_Prototype_Training_Dataset.xlsx
│   └── normalized/
│
├── docs/
│   ├── dataset-methodology.md
│   └── ai-relation-justification.md
│
└── README.md
```

---

# 25. Definition of Done for MVP

The MVP is successful when an R&D user can:

```text
1. create/select a product

2. enter clean product insight

3. enter current formulation

4. enter current process

5. define allowable adjustment ranges

6. click Generate Recommendations

7. receive structured technical targets

8. receive Top 3 candidate adjustments

9. inspect predicted impacts and evidence

10. select a candidate for validation

11. enter physical lab results

12. save the result as new measured experiment data
```

The system does **not** need to prove a scientifically production-ready general model in the MVP.

The MVP goal is to demonstrate the closed workflow:

```text
INSIGHT
   ↓
AI-GUIDED EXPERIMENT
   ↓
PHYSICAL VALIDATION
   ↓
LEARNING DATA
```

---

# 26. One-Sentence Product Definition

> **A decision-support platform for cosmetic R&D that converts validated consumer insights into ranked, evidence-traceable formulation and process adjustments for an existing product, then captures physical validation results to improve future recommendations.**

---

# 27. Related Project Documents

Recommended files to keep in `/docs`:

```text
Consumer_Guided_Formulation_Optimization_Dataset_Methodology.md

AI_Relation_Justification_and_Evidence_Traceability.md
```

Prototype dataset:

```text
Phase2_500_Prototype_Training_Dataset.xlsx
```

These documents explain:

```text
how the dataset was created
which scientific relations are captured
which rows are measured vs model-generated
how AI recommendations must be justified
```
