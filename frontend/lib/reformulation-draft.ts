export type IngredientDraft = { name: string; concentration: number; fixed: boolean; min: number; max: number };
export type ReformulationDraft = {
  product: string; category: string; version: string; insight: string; insightOrigin: "manual" | "library_demo";
  target: "hydration" | "stickiness"; direction: "increase" | "decrease"; preserve: string;
  ingredients: IngredientDraft[]; temperature: number; speed: number; duration: number; confirmed: boolean;
};
export function initialDraft(insight = ""): ReformulationDraft {
  return { product: "Emulsion prototype — demo", category: "Cosmetic emulsion", version: "V1",
    insight, insightOrigin: insight ? "library_demo" : "manual", target: "hydration", direction: "increase",
    preserve: "Identitas bahan; active system ditetapkan R&D", confirmed: false,
    ingredients: [
      {name:"Phytantriol", concentration:1.5, fixed:false, min:0, max:3},
      {name:"Soy lecithin", concentration:1.5, fixed:false, min:0, max:3},
      {name:"CCT", concentration:2.5, fixed:false, min:0, max:5},
    ], temperature:70, speed:3000, duration:10 };
}
export function validateStep(step: number, draft: ReformulationDraft): string {
  if (step === 0 && (!draft.product.trim() || !draft.category.trim() || !draft.version.trim())) return "Isi nama produk, kategori, dan formula version.";
  if (step === 1 && (!draft.insight.trim() || !draft.confirmed)) return "Isi clean insight dan konfirmasi target teknis oleh R&D.";
  if (step === 2) {
    for (const ingredient of draft.ingredients) {
      if (!Number.isFinite(ingredient.concentration) || (!ingredient.fixed && ![ingredient.min,ingredient.max].every(Number.isFinite))) return "Konsentrasi dan batas harus berupa angka finite.";
      if (ingredient.concentration < 0 || ingredient.concentration > 100 || (!ingredient.fixed && (ingredient.min < 0 || ingredient.max > 100 || ingredient.min > ingredient.max))) return "Periksa min/max dan konsentrasi 0–100%.";
      if (!ingredient.fixed && (ingredient.concentration < ingredient.min || ingredient.concentration > ingredient.max)) return "Baseline adjustable harus berada di dalam batasnya.";
    }
    if (draft.ingredients.reduce((sum,item)=>sum+item.concentration,0)>100) return "Total faktor bahan tidak boleh melebihi 100%.";
    if (![draft.temperature,draft.speed,draft.duration].every(Number.isFinite) || draft.temperature < 0 || draft.temperature > 150 || draft.speed <= 0 || draft.duration <= 0) return "Periksa suhu 0–150 °C, speed, dan durasi positif.";
  }
  return "";
}
