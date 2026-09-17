# Spontan — AI Formulation Intelligence Platform
## UI/UX System Explanation

---

# 1. Product Overview

## Vision

Spontan is an AI-assisted R&D workspace designed to help cosmetic formulation scientists accelerate product development through predictive formulation optimization.

The platform transforms the traditional formulation workflow from a trial-and-error process into an evidence-driven optimization workflow.

The system supports scientists by answering:

- Which formulation variables should be changed?
- Which experiments should be prioritized?
- How can an existing formula be improved while maintaining constraints?

AI acts as a decision-support system:

> AI proposes, R&D decides, laboratory validates.

The platform does not replace formulation scientists or guarantee final product success.

---

# 2. Main Users

## Primary User

### Cosmetic R&D / Formulation Scientist

Main responsibilities:

- Develop new formulations
- Improve existing products
- Validate laboratory experiments
- Make technical decisions

Main problems:

- Long formulation iteration cycles
- Large ingredient search space
- Difficulty tracking previous experiments
- Dependency on expert knowledge

---

## Secondary User

### Marketing / Consumer Insight Team

Role:

Provide consumer feedback translated into technical objectives.

Example:

Consumer feedback:

> "The moisturizer feels sticky."

Converted into:

```
Target:
Reduce stickiness

Maintain:
Hydration performance

Constraint:
Maintain current cost range
```

---

# 3. Application Structure

The platform consists of three connected modules:

```
Spontan Workspace

        |
        |

+----------------------+
| Formula Rescue       |
+----------------------+

Solve ingredient availability problems


+----------------------+
| AI Reformulation     |
+----------------------+

Optimize existing products


+----------------------+
| Dataset Library      |
+----------------------+

Store formulation knowledge
```

---

# 4. User Journey Overview

```
Login

 ↓

Dashboard

 ↓

Choose Workflow


       Formula Rescue

       AI Reformulation

       Dataset Library


 ↓

Generate Insights

 ↓

R&D Decision

 ↓

Laboratory Validation

 ↓

Knowledge Update
```

---

# 5. AI Reformulation User Flow

## Step 1 — Product Selection

User selects:

```
Product:
Wardah Moisturizer

Category:
Skincare

Current Version:
Formula V1
```

Purpose:

Define the baseline formulation.

---

# Step 2 — Clean Insight Input

Input:

```
Consumer Complaint:

"Product feels sticky"
```

Converted into technical objectives:

```
Technical Target:

Decrease stickiness

Maintain:
Hydration

Constraints:
Keep formulation cost
Maintain safety requirements
```

---

# Step 3 — Baseline Formula Input

## Ingredient Parameters

| Ingredient | Concentration | Status |
|-|-|-|
| Niacinamide | 5% | Adjustable |
| Glycerin | 8% | Adjustable |
| Preservative | 1% | Fixed |

## Process Parameters

| Parameter | Value |
|-|-|
| Mixing temperature | 70°C |
| Mixing speed | 3000 rpm |
| Homogenization time | 10 min |

---

# Step 4 — AI Reformulation Engine

Input:

```
Formula V1

+

Consumer Insight

+

Ingredient Constraints

+

Process Parameters
```

Processing:

```
Input Formula

        ↓

Feature Extraction

        ↓

Machine Learning Model

        ↓

Optimization Algorithm

        ↓

Candidate Formula Generation
```

The model optimizes:

- Ingredient concentration
- Process parameters
- Product performance
- Stability
- Sensory targets
- Cost constraints

---

# Step 5 — Formula Recommendation

The AI provides multiple candidates.

## Candidate A — Performance Optimized

```
Hydration:
+15%

Texture:
Improved

Cost:
+5%
```

## Candidate B — Cost Optimized

```
Performance:
Maintained

Cost:
-10%
```

## Candidate C — Sustainability Optimized

```
Performance:
Maintained

Sustainability:
Improved
```

---

# Step 6 — Explainability Layer

Every recommendation shows:

## What changed?

Example:

```
Glycerin:

8%

↓

6%
```

## Why?

Example:

```
Historical formulas with similar composition
show improved sensory score after reducing
glycerin concentration.
```

## Evidence

```
Reference Formula:

Formula #124

Observed Result:

Reduced stickiness score
```

---

# Step 7 — Laboratory Validation Loop

```
AI Recommendation

        ↓

R&D Creates Prototype

        ↓

Laboratory Testing

        ↓

Measured Results

        ↓

Compare Prediction vs Reality

        ↓

Update Knowledge Base
```

Stored validation data:

- Formula version
- Process version
- Experiment ID
- Test method
- Measurement results
- Acceptance/rejection status

---

# 8. Dataset Library UX

Dataset Library acts as the company's formulation memory.

## Tab 1 — Clean Insight

Contains:

- Consumer feedback
- Product context
- Technical objectives

Used as AI Reformulation input.

---

## Tab 2 — Formula Rescue History

Contains:

- Original formula
- Ingredient constraint
- Alternative candidates
- Model output

---

## Tab 3 — AI Reformulation History

Contains:

- Baseline formula
- Optimization objective
- Candidate formulas
- Validation results

---

# 9. Complete System Architecture

```
                  DATA SOURCES


 Existing Formula Database

 Ingredient Database

 Consumer Insight

 Manufacturing Parameters

 Laboratory Results


             ↓


          DATA PROCESSING


 Clean Insight Extraction

 Feature Engineering

 Formulation Knowledge Base


             ↓


        AI REFORMULATION ENGINE


 +--------------------------------+

 | Formula Prediction Model       |
 | Ingredient Optimization        |
 | Process Optimization           |
 | Candidate Ranking              |

 +--------------------------------+


             ↓


       USER INTERFACE


 Formula Recommendation

 Explanation

 Evidence

 Experiment Planning


             ↓


        LAB VALIDATION


             ↓


       KNOWLEDGE UPDATE
```

---

# 10. UX Design Principles

## 1. AI as Assistant, Not Replacement

The system supports scientists.

Scientists control:

- Target improvement
- Constraints
- Final validation

---

## 2. Evidence-Based Recommendation

Every AI suggestion includes:

- Input data
- Modification
- Reason
- Supporting evidence

---

## 3. Human-in-the-Loop

```
AI Prediction

↓

Human Decision

↓

Laboratory Validation
```

---

## 4. Continuous Learning

```
Experiment

↓

Measured Result

↓

Knowledge Base

↓

Better AI Prediction
```

---

# 11. Final Product Narrative

Spontan transforms cosmetic R&D by converting historical formulation knowledge into predictive intelligence.

Instead of repeatedly testing hundreds of formulation variations, scientists can:

1. Define the product problem
2. Provide formulation constraints
3. Receive AI-generated experiment candidates
4. Validate through laboratory testing
5. Build a continuously improving formulation knowledge system

The platform enables faster, more accurate, and more explainable cosmetic product development.
