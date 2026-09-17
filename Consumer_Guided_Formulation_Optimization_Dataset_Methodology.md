# Consumer-Guided Formulation Optimization  
## Project Context and Phase 2 Dataset Development

**Version:** 2026-09-17  
**Dataset:** `Phase2_500_Prototype_Training_Dataset.xlsx`  
**Current scope:** cosmetic/topical formulation optimization using **existing ingredient systems**, with adjustments primarily through **ingredient concentration and manufacturing-process parameters**.

---

## 1. Project Context

The project aims to build an AI-assisted cosmetic R&D system that starts from **post-market consumer feedback** and converts it into **technically testable formulation-improvement hypotheses**.

The core idea is:

```text
Recent product line-up
        ↓
Consumer feedback / reviews
        ↓
Voice-of-Customer (VOC) mining
        ↓
Identify product strengths and pain points
        ↓
Translate consumer language into technical product attributes
        ↓
Predict which formulation variables should be adjusted
        ↓
Recommend the next experiment
        ↓
Lab validation
        ↓
Measured result returned to the dataset
```

An example use case is a Vitamin C cream receiving feedback such as:

> “It brightens well, but feels dry/tight and is not moisturizing enough.”

The system should **not** directly conclude:

```text
"Add ingredient X."
```

Instead, the intended reasoning chain is:

```text
Consumer feedback
    ↓
Brightening = strength to preserve
Dry/tight feel = weakness to improve
Hydration = weakness to improve
    ↓
Technical targets
    ↓
Hydration ↑
Dry/tight after-feel ↓
Stickiness/oiliness kept acceptable
Brightening-related system preserved
    ↓
Search formulation/process design space
    ↓
Recommend concentration/process adjustments for lab testing
```

At the current stage, the project intentionally assumes that **ingredient identities remain unchanged**. The AI is therefore learning which existing formulation “knobs” can be adjusted, for example:

- ingredient concentration,
- ratio between existing components,
- homogenization speed,
- addition temperature,
- mixing duration,
- cooling conditions,
- other manufacturing-process parameters.

This makes the first version of the problem narrower and more scientifically interpretable than open-ended ingredient generation.

---

## 2. What the AI Actually Needs to Learn

The core predictive relationship is:

```text
Formulation composition
+
Manufacturing process
        ↓
Measured product response
```

or mathematically:

\[
f(X_\text{composition}, X_\text{process})
\rightarrow
Y_\text{product properties}
\]

Examples of possible output properties include:

- hydration,
- stickiness,
- oiliness,
- consistency,
- viscosity,
- rheology,
- adhesiveness,
- droplet size,
- phase stability,
- firmness,
- spreadability,
- friction.

The VOC layer is therefore **not the training target of the formulation model itself**.

Instead:

```text
VOC model
"dry / tight"
        ↓
technical target
hydration ↑
friction / tightness ↓
        ↓
formulation model
Which concentration/process changes are predicted to move these targets?
```

This distinction is fundamental:

> **VOC defines what should improve. The formulation model predicts how formulation or process adjustments may change the product.**

---

## 3. Why Experimental Matrix Data Is Needed

A conventional ingredient database may tell us:

```text
Glycerin → humectant
Oil → emollient
Polymer → rheology modifier
```

but this does not answer:

```text
If concentration changes from A to B,
how much does hydration, stickiness, viscosity,
or stability change in this formulation system?
```

For AI-driven formulation optimization, the required training unit is therefore:

> **One row = one formulation/process experiment and its measured product responses.**

A simplified training row looks like:

| Input | Example |
|---|---:|
| Humectant concentration | 5% |
| Emollient concentration | 10% |
| Polymer concentration | 0.3% |
| Homogenization speed | 4000 rpm |
| Temperature | 70 °C |
| Hydration | measured value |
| Stickiness | measured value |
| Viscosity | measured value |
| Stability | measured result |

This lets the model learn **“knobs and consequences.”**

---

# 4. Source Selection Strategy

Papers were selected based on a stricter criterion than simply being “about cosmetics.”

The useful paper pattern is:

```text
Known formulation system
        ↓
Systematic change in concentration and/or process
        ↓
Experimental design (DoE)
        ↓
Numeric product-response measurements
        ↓
Published relationship or response-surface model
```

The Phase 2 dataset uses four literature blocks.

---

## 5. Literature Blocks Used

### 5.1 Mercurio et al. — Composition → Sensory / Hydration

**Paper:**  
*Optimization of cosmetic formulations development using Box–Behnken design with response surface methodology: physical, sensory and moisturizing properties*

**DOI:** `10.1590/S2175-97902020000318502`

**Source:**  
https://www.scielo.br/j/bjps/a/MxDgqHGqq43Rn4VMDgcRqyw/

### What was adjusted

Phase II studied three formulation factors:

| Factor | Range |
|---|---:|
| Phytantriol | 0–3% |
| Soy lecithin | 0–3% |
| Caprylic/capric triglycerides | 0–5% |

### What was evaluated

- consistency index,
- stickiness,
- oiliness,
- immediate moisturizing / hydration response.

### Key relationship

This block is the most directly relevant to the intended consumer-insight workflow because it links:

```text
Ingredient concentration
        ↓
Hydration
Stickiness
Oiliness
Consistency
```

For example, the paper reports models showing that soy lecithin level contributes to both moisturizing response and sensory/consistency responses, illustrating a real formulation trade-off:

```text
Improving one attribute
may worsen another attribute.
```

### Data availability in the current dataset

The paper reports 15 Phase-II formulations and publishes fitted response equations.

However, the complete measured response table for every Phase-II run was not used as row-level ground truth in the current dataset.

Therefore:

```text
Mercurio rows in Phase 2
=
MODEL-GENERATED FROM PUBLISHED EQUATIONS
```

They are scientifically traceable predictions from the authors' models, **not new experiments**.

---

## 5.2 Oliveira et al. — Cream Composition → Physical Properties

**Paper:**  
*Development and Optimization of a Topical Formulation with Castanea sativa Shells Extract Based on the Concept “Quality by Design”*

**DOI:** `10.3390/su14010129`

### What was adjusted

| Factor | Range |
|---|---:|
| Sodium lauryl sulfate | 0.5–1.5% |
| Beeswax | 2–5% |
| Macadamia oil | 6–10% |

### What was measured

- pH,
- viscosity,
- adhesiveness.

### Why it is useful

It provides a directly measured cream-formulation matrix:

```text
Composition
    ↓
Physical / application properties
```

The authors also published response-surface equations for these outputs.

### Data availability

The Phase 2 dataset contains:

- **17 measured formulation rows**
- **153 model-generated rows**

The measured rows are preserved as empirical ground truth.

The generated rows are sampled within the exact published factor ranges and evaluated using the authors' equations.

---

## 5.3 Anicescu et al. — Microemulsion Composition → Microstructure / Application Properties

**Paper:**  
*Insights from a Box–Behnken Optimization Study of Microemulsions with Salicylic Acid for Acne Therapy*

**DOI:** `10.3390/pharmaceutics14010174`

**Source:**  
https://www.mdpi.com/1999-4923/14/1/174

### What was adjusted

| Factor | Range |
|---|---:|
| Tween 80 / propylene glycol blend | 20–40% |
| Lecithin | 0.1–0.5% |
| Oat oil | 1–2% |

### What was measured

- viscosity,
- mean droplet size,
- work of adhesion.

### Why it is useful

This study adds relationships such as:

```text
Composition
    ↓
Microstructure
    ↓
Application-relevant product properties
```

The reported response models also include nonlinear terms and interactions, which supports using nonlinear or response-surface-aware ML models.

### Data availability

The Phase 2 dataset contains:

- **13 measured rows**
- **152 model-generated rows**

Synthetic points were restricted to the source factor range and additionally filtered so the predicted responses remained within the experimentally observed response range reported by the paper.

---

## 5.4 Chow et al. — Process → Product Properties

**Paper:**  
*Influence of Manufacturing Process on the Microstructure, Stability, and Sensorial Properties of a Topical Ointment Formulation*

**DOI:** `10.3390/pharmaceutics15092219`

**Source:**  
https://pmc.ncbi.nlm.nih.gov/articles/PMC10536044/

### Base composition

The formulation composition was held fixed:

| Ingredient | Concentration |
|---|---:|
| Propylene glycol | 9% |
| White petrolatum | 79% |
| Mono-/diglycerides | 7% |
| Paraffin wax | 5% |

### What was adjusted

Examples include:

- homogenization speed,
- propylene-glycol addition temperature,
- mixing duration,
- final-cooling homogenization.

### What was measured

Examples include:

- instability index,
- complex shear modulus \(G^*\),
- firmness,
- adhesive force,
- spreadability,
- friction coefficient.

### Why it is useful

Chow answers a different but complementary question:

> Can product properties be improved **without changing ingredient concentrations**, only by changing manufacturing conditions?

The relation is:

```text
Same composition
+
Different process
        ↓
Different stability / rheology / texture / sensory proxy
```

### Data availability

The Phase 2 dataset includes:

- **12 real measured process experiments**
- no synthetic Chow augmentation.

---

# 6. Dataset Normalization

The four studies use different formulations, terminology, units, and measurements.

They therefore cannot be naïvely concatenated as if all 500 rows belonged to one identical formulation system.

The normalization strategy preserves both:

1. **a common machine-readable schema**, and  
2. **the scientific context of each study**.

Each row contains fields such as:

```text
row_id
study_id
product_system
adjustment_scope

data_origin
is_empirical_ground_truth
generation_method

source_doi
source_url
source_location

factor_1_name
factor_1_value
factor_1_unit

factor_2_name
factor_2_value
factor_2_unit

factor_3_name
factor_3_value
factor_3_unit

process parameters

response variables

training_role
validation_role
critical_note
```

This means:

```text
Same database structure
≠
Same scientific system
```

The `study_id`, `product_system`, `data_origin`, and source metadata remain mandatory.

---

# 7. How the 500 Rows Were Created

The Phase 2 dataset contains **exactly 500 rows**.

| Source block | Measured | Model-generated | Total |
|---|---:|---:|---:|
| Chow 2023 | 12 | 0 | 12 |
| Oliveira 2022 | 17 | 153 | 170 |
| Anicescu 2022 | 13 | 152 | 165 |
| Mercurio Phase II | 0 | 153 | 153 |
| **TOTAL** | **42** | **458** | **500** |

Therefore:

> **500 rows are available numerically for prototyping, but only 42 rows are independent measured experiments.**

This distinction must always be preserved.

---

# 8. Generation of Synthetic / Model-Derived Rows

The additional rows were not created by inventing arbitrary relationships.

The process was:

```text
Published factor range
        ↓
Sample new combinations inside the range
        ↓
Use author-published response equation
        ↓
Calculate predicted response
        ↓
Label as MODEL_GENERATED
```

## 8.1 Sampling method

The design space was sampled using **Latin Hypercube Sampling (LHS)**.

This is preferable to simple random sampling because it distributes the generated points more evenly throughout the allowed design space.

The synthetic design used a fixed random seed:

```text
20260917
```

for reproducibility.

---

## 8.2 No extrapolation

Synthetic rows were generated **only inside the design ranges used by the original studies**.

For example:

```text
Oliveira

SLS          0.5–1.5%
Beeswax      2–5%
Macadamia    6–10%
```

The generator does not intentionally create:

```text
SLS = 4%
```

because that lies outside the evidence domain of the published model.

This is important because a regression equation may produce a numeric result outside its validated experimental region even when the prediction has little scientific meaning.

---

## 8.3 Additional filtering for Anicescu

For the Anicescu block, generated combinations were required to satisfy both:

```text
inside published factor range
```

and:

```text
predicted responses inside the paper's observed response range
```

This reduces obviously unrealistic synthetic points.

It still does **not** convert synthetic rows into empirical evidence.

---

# 9. Evidence Labels

Every row is explicitly labeled.

## `MEASURED`

Meaning:

```text
Actual formulation/process experiment
+
actual measurement reported in source
```

These rows can serve as empirical ground truth.

---

## `MODEL_GENERATED_PUBLISHED_EQUATION`

Meaning:

```text
New input combination
+
output calculated using a model
published by the original authors
```

These rows are useful for:

- prototype model development,
- testing optimization logic,
- testing data pipelines,
- developing inverse-search algorithms,
- UI demonstrations.

But:

> They must never be described as new laboratory experiments.

---

# 10. Why 500 Synthetic-Augmented Rows Can Still Be Useful

A machine-learning pipeline often requires enough numeric rows to test:

- preprocessing,
- feature engineering,
- prediction APIs,
- optimizer integration,
- uncertainty logic,
- ranking,
- user-interface flow.

With only 15–40 rows, it is difficult to test these engineering components.

The 500-row dataset therefore serves as a **prototype training environment**.

It allows development of:

```text
composition/process
        ↓
forward prediction model
        ↓
inverse optimizer
```

without falsely claiming that 500 independent experiments have been performed.

---

# 11. Why 500 Rows Do Not Equal 500 Independent Experimental Observations

This is a central limitation.

If 153 values are generated from one equation:

```text
y = f(x)
```

then training a model on those 153 points mostly teaches the model to approximate that equation.

It does **not** provide the same scientific information as 153 new laboratory experiments.

Therefore:

```text
Numerical sample count = 500
Scientific independent evidence = much smaller
```

The current empirical ground truth is:

```text
42 measured rows
```

This is why the Phase 2 dataset should be described as:

> **a 500-record prototype dataset containing 42 measured experimental observations and 458 scientifically constrained model-generated records derived from peer-reviewed response-surface models.**

---

# 12. Recommended Training Strategy

The current dataset should **not** be used to train one universal cosmetic model.

Instead, train task-specific forward models.

---

## 12.1 Sensory / Hydration Composition Model

Primary source:

```text
Mercurio
```

Input:

```text
Phytantriol %
Soy lecithin %
CCT %
```

Output:

```text
Hydration
Stickiness
Oiliness
Consistency
```

This block is closest to the target use case:

```text
Consumer complaint
→ sensory/hydration target
→ concentration adjustment
```

---

## 12.2 Cream Physical-Property Model

Primary source:

```text
Oliveira
```

Input:

```text
SLS %
Beeswax %
Macadamia oil %
```

Output:

```text
pH
Viscosity
Adhesiveness
```

The 17 measured rows can serve as empirical anchors for evaluating predictions derived from the published response model.

---

## 12.3 Microemulsion Property Model

Primary source:

```text
Anicescu
```

Input:

```text
Tween80/PG %
Lecithin %
Oat oil %
```

Output:

```text
Viscosity
Droplet size
Work of adhesion
```

---

## 12.4 Process Model

Primary source:

```text
Chow
```

Input:

```text
Homogenization speed
Addition temperature
Mixing duration
Final homogenization
```

Output:

```text
Stability
G*
Firmness
Spreadability
Friction
```

This model answers:

> Can the problem be improved through manufacturing changes rather than formulation-composition changes?

---

# 13. Intended Runtime System

The complete project can eventually work as:

```text
                CONSUMER FEEDBACK
                       │
                       ▼
            VOC / ASPECT-SENTIMENT AI
                       │
                       ▼
              PRODUCT ATTRIBUTE MAP
                       │
        ┌──────────────┴──────────────┐
        │                             │
    PRESERVE                       IMPROVE
   brightening                  hydration
                                after-feel
                       │
                       ▼
             TECHNICAL TARGETS
                       │
                       ▼
           SELECT RELEVANT MODEL
                       │
             ┌─────────┴─────────┐
             │                   │
      COMPOSITION MODEL      PROCESS MODEL
             │                   │
             └─────────┬─────────┘
                       ▼
              FORWARD PREDICTION
                       │
                       ▼
                INVERSE SEARCH
                       │
                       ▼
         RECOMMENDED NEXT EXPERIMENT
                       │
                       ▼
                     LAB
                       │
                       ▼
              MEASURE ACTUAL RESULT
                       │
                       ▼
           APPEND AS MEASURED DATA
                       │
                       └────→ MODEL IMPROVES
```

---

# 14. Example Runtime Scenario

Suppose review mining produces:

```text
Brightening: strongly positive
Hydration: negative
Dry/tight after-feel: negative
```

The technical objective becomes:

```text
PRESERVE:
brightening system

IMPROVE:
hydration ↑
dry/tight feel ↓

CONSTRAINT:
stickiness not excessive
oiliness not excessive
stability remains acceptable
```

The formulation optimizer does **not** need to redesign the product from scratch.

Instead, it searches only the allowed formulation space:

```text
current ingredient identities remain fixed

Possible changes:
ingredient concentration
ingredient ratios
process parameters
```

For example:

```text
Candidate experiment

Soy lecithin     1.5 → 2.1%
CCT              2.5 → 3.0%
Phytantriol      1.5 → 1.2%

Predicted:
hydration ↑
stickiness within target
oiliness within target
consistency acceptable
```

This remains a **hypothesis** until it is tested in the lab.

---

# 15. Why the Dataset Should Become a Closed Learning Loop

The long-term value does not come from indefinitely generating more literature-based synthetic rows.

The desired progression is:

```text
Literature seed data
        ↓
Prototype model
        ↓
AI recommends experiment
        ↓
Company lab tests it
        ↓
Actual measured result
        ↓
Append to dataset
        ↓
Retrain model
        ↓
Next recommendation improves
```

Eventually:

```text
Internal measured formulation history
>>
literature-derived synthetic data
```

in importance.

That internal dataset becomes the strongest proprietary asset because it captures the company's:

- actual ingredient portfolio,
- actual manufacturing process,
- actual sensory standards,
- actual stability criteria,
- actual consumer/product targets.

---

# 16. What Should Be Collected From Every New Internal Experiment

Every future experiment should record at least:

## Formula

```text
ingredient identity
ingredient role
supplier/grade
concentration
```

## Process

```text
addition order
mixing speed
mixing time
homogenization speed
homogenization time
temperature
cooling profile
batch size
```

## Physical responses

```text
pH
viscosity
rheology
droplet size
stability
```

## Sensory responses

```text
stickiness
greasiness
spreadability
absorption
smoothness
tightness / friction
```

## Functional responses

when available:

```text
hydration
TEWL
active retention
efficacy proxy
```

## Provenance

```text
experiment ID
formula version
date
operator
instrument
measurement method
replicate
uncertainty / SD
```

---

# 17. Main Limitations of the Current Phase 2 Dataset

The current dataset is useful for a prototype, but several limitations must remain explicit.

### Different formulation systems

The studies include:

- topical ointment,
- cosmetic emulsion,
- topical cream,
- microemulsion.

Their absolute response values should not be treated as universally interchangeable.

---

### Different measurements

Examples such as:

```text
adhesiveness N·mm
work of adhesion mN/m
adhesive force g
```

are related concepts but **not the same metric**.

They must remain separate features/targets.

---

### Synthetic-data dependence

458/500 rows are generated from published response equations.

This creates numerical density, not equivalent experimental evidence.

---

### Limited consumer-property coverage

The current literature blocks cover attributes such as:

- hydration,
- stickiness,
- oiliness,
- viscosity,
- adhesiveness,
- stability,
- friction.

They do not yet provide a complete mapping for all possible cosmetic complaints.

---

# 18. Next Dataset Development Priority

The next phase should prioritize **additional independent measured DoE studies**, especially studies with:

```text
same ingredient system
+
concentration variation
+
sensory / hydration / rheology / stability output
+
full numeric experiment matrix
```

The priority is not:

```text
500 → 5,000 synthetic rows
```

but:

```text
42 measured rows
        ↓
100 measured rows
        ↓
200 measured rows
        ↓
500+ measured rows
```

while preserving the same normalized schema.

The strongest future dataset would combine:

```text
public measured DoE studies
+
internal historical formulation experiments
+
new AI-recommended lab experiments
```

---

# 19. Final Position of the Phase 2 Dataset

The Phase 2 dataset should be viewed as:

> **A scientifically traceable prototype dataset for building and testing a consumer-guided formulation optimization pipeline.**

It already supports the engineering flow:

```text
Technical target
        ↓
Formulation/process variables
        ↓
Forward model
        ↓
Predicted response
        ↓
Optimization
        ↓
Recommended next experiment
```

but it is **not yet sufficient evidence for a universal autonomous reformulation model**.

The intended system remains human-in-the-loop:

> **AI proposes the most promising formulation adjustment; the laboratory determines what actually happens.**

---

## References

1. Chow PS et al. *Influence of Manufacturing Process on the Microstructure, Stability, and Sensorial Properties of a Topical Ointment Formulation.* Pharmaceutics. 2023. DOI: `10.3390/pharmaceutics15092219`  
   https://pmc.ncbi.nlm.nih.gov/articles/PMC10536044/

2. Mercurio DG, Calixto LS, Maia Campos PMBG. *Optimization of cosmetic formulations development using Box–Behnken design with response surface methodology: physical, sensory and moisturizing properties.* Brazilian Journal of Pharmaceutical Sciences. DOI: `10.1590/S2175-97902020000318502`  
   https://www.scielo.br/j/bjps/a/MxDgqHGqq43Rn4VMDgcRqyw/

3. Oliveira N et al. *Development and Optimization of a Topical Formulation with Castanea sativa Shells Extract Based on the Concept “Quality by Design”.* Sustainability. 2022. DOI: `10.3390/su14010129`

4. Anicescu M-C et al. *Insights from a Box–Behnken Optimization Study of Microemulsions with Salicylic Acid for Acne Therapy.* Pharmaceutics. 2022. DOI: `10.3390/pharmaceutics14010174`  
   https://www.mdpi.com/1999-4923/14/1/174

---

## Related Dataset Artifact

`Phase2_500_Prototype_Training_Dataset.xlsx`

Dataset composition:

```text
500 total records

42  = measured experimental rows
458 = model-generated rows

488 = composition-focused
12  = process-focused
```
