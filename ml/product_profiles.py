"""Public product identifiers with explicitly synthetic prototype formulation profiles."""

DISCLAIMER = "Predicted / estimated and requires physical laboratory validation."
DATA_ORIGIN = "SYNTHETIC_PROTOTYPE_DATA"
FEATURES = ["factor_a_pct", "factor_b_pct", "factor_c_pct"]
TARGETS = [
    "hydration_ratio",
    "stickiness_score_0_10",
    "oiliness_score_0_10",
    "consistency_index",
]


def factor(key, label, maximum, baseline):
    return {"key": key, "label": label, "unit": "%", "min": 0.0,
            "max": float(maximum), "baseline": float(baseline)}


CATEGORY_FACTORS = {
    "moisturizing_cream": [("Humectant system", 10, 4.0), ("Emollient system", 15, 8.0), ("Structurant", 5, 2.2)],
    "gel_moisturizer": [("Humectant system", 10, 4.5), ("Light emollient", 8, 3.0), ("Gel structurant", 4, 1.2)],
    "facial_cleanser": [("Primary surfactant", 18, 9.0), ("Secondary surfactant", 10, 4.0), ("Conditioning humectant", 8, 2.5)],
    "face_serum": [("Functional active system", 10, 4.0), ("Humectant system", 12, 5.0), ("Solubilizer / structurant", 5, 1.5)],
    "face_toner": [("Humectant system", 10, 3.5), ("Functional active system", 6, 2.0), ("Solubilizer", 4, 1.0)],
    "sunscreen": [("UV filter system", 25, 15.0), ("Emollient system", 15, 6.0), ("Structurant / dispersant", 6, 2.0)],
    "micellar_water": [("Micellar surfactant", 8, 2.5), ("Humectant system", 10, 3.0), ("Oil / solubilizer system", 6, 1.5)],
    "shampoo": [("Primary surfactant", 20, 10.0), ("Conditioning system", 6, 2.0), ("Rheology modifier", 5, 1.2)],
    "body_wash": [("Primary surfactant", 18, 9.0), ("Secondary surfactant", 10, 4.0), ("Humectant system", 8, 2.5)],
    "foundation": [("Pigment / powder phase", 25, 14.0), ("Emollient system", 18, 8.0), ("Structurant / film former", 10, 4.0)],
    "lip_cream": [("Pigment phase", 25, 13.0), ("Emollient system", 20, 9.0), ("Film former / structurant", 12, 5.0)],
}

CATEGORY_NAMES = {
    "moisturizing_cream": "Moisturizing Cream", "gel_moisturizer": "Gel Moisturizer",
    "facial_cleanser": "Facial Cleanser", "face_serum": "Face Serum",
    "face_toner": "Face Toner", "sunscreen": "Sunscreen",
    "micellar_water": "Micellar Water", "shampoo": "Shampoo",
    "body_wash": "Body Wash", "foundation": "Foundation", "lip_cream": "Lip Cream",
}

PRODUCT_ROWS = [
    ("wardah-lightening-day-cream", "Wardah", "Lightening Day Cream Advanced Niacinamide", "moisturizing_cream", 1.00),
    ("emina-bright-stuff-moisturizing-cream", "Emina", "Bright Stuff Moisturizing Cream", "moisturizing_cream", 0.88),
    ("wardah-radiant-charge-gel", "Wardah", "Radiant Charge Gel Moisturizer", "gel_moisturizer", 1.00),
    ("emina-water-bright-glow-gel", "Emina", "Water Bright Glow Gel", "gel_moisturizer", 0.90),
    ("wardah-hydra-rose-cleanser", "Wardah", "Hydra Rose Gel-to-Foam Cleanser", "facial_cleanser", 1.00),
    ("kahf-oil-comedo-face-wash", "Kahf", "Triple Action Oil and Comedo Defense Face Wash", "facial_cleanser", 1.10),
    ("wardah-radiant-charge-serum", "Wardah", "Radiant Charge Serum", "face_serum", 1.00),
    ("emina-bright-stuff-serum", "Emina", "Bright Stuff Face Serum", "face_serum", 0.90),
    ("wardah-hydra-rose-toner", "Wardah", "Hydra Rose Petal Infused Toner", "face_toner", 1.00),
    ("emina-double-the-moist-toner", "Emina", "Double The Moist Face Toner", "face_toner", 0.88),
    ("wardah-uv-shield-physical", "Wardah", "UV Shield Physical Sunscreen Serum", "sunscreen", 1.00),
    ("emina-sun-battle-45", "Emina", "Sun Battle SPF 45 PA+++", "sunscreen", 0.92),
    ("wardah-lightening-micellar", "Wardah", "Lightening Oil-Infused Micellar Water", "micellar_water", 1.00),
    ("emina-skin-buddy-micellar", "Emina", "Skin Buddy Micellar Water", "micellar_water", 0.88),
    ("wardah-anti-dandruff-shampoo", "Wardah", "Anti Dandruff Shampoo", "shampoo", 1.00),
    ("putri-ginseng-shampoo", "Putri", "Shampoo with Ginseng Extract", "shampoo", 0.92),
    ("kahf-brightening-cooling-body-wash", "Kahf", "Brightening and Cooling Body Wash", "body_wash", 1.00),
    ("biodef-mint-green-tea-body-wash", "Biodef", "Natural Protection Mint–Green Tea Body Wash", "body_wash", 0.90),
    ("wardah-colorfit-matte-foundation", "Wardah", "Colorfit Matte Foundation", "foundation", 1.00),
    ("make-over-powerstay-foundation", "Make Over", "Powerstay Total Cover Matte Cream Foundation", "foundation", 1.08),
    ("wardah-exclusive-matte-lip-cream", "Wardah", "Exclusive Matte Lip Cream", "lip_cream", 1.00),
    ("emina-creamatte", "Emina", "Creamatte", "lip_cream", 0.90),
]


def build_catalog():
    products = []
    for product_id, brand, name, category_id, scale in PRODUCT_ROWS:
        factors = [factor(FEATURES[i], label, maximum, round(baseline * scale, 3))
                   for i, (label, maximum, baseline) in enumerate(CATEGORY_FACTORS[category_id])]
        products.append({
            "product_id": product_id, "brand": brand, "product_name": name,
            "category_id": category_id, "category_name": CATEGORY_NAMES[category_id],
            "factors": factors, "profile_origin": DATA_ORIGIN,
        })
    return products


PRODUCTS = build_catalog()
PRODUCT_BY_ID = {row["product_id"]: row for row in PRODUCTS}
