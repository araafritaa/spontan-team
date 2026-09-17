import { backendUrl } from "../../../../lib/server-backend";
type Context = { params: Promise<{ action: string }> };
export const runtime = "nodejs";
function reply(detail: string, status: number) {
  return Response.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
}
export async function GET(request: Request, context: Context) {
  const { action } = await context.params;
  if (action !== "products") return reply("Endpoint tidak tersedia.", 404);
  if (!process.env.SPONTAN_BACKEND_URL?.trim() && !process.env.FORMULARESCUE_API_URL?.trim()) return reply("Backend gabungan belum dikonfigurasi. Periksa binding Services atau API lokal.", 503);
  try {
    const response = await fetch(backendUrl("/ai-reformulation/products"), { cache: "no-store", redirect: "error",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]) });
    if (!response.ok) return reply("Katalog produk belum tersedia dari backend.", response.status === 503 ? 503 : 502);
    const result: unknown = await response.json().catch(() => null);
    if (typeof result !== "object" || result === null || Array.isArray(result)) return reply("Respons katalog backend tidak valid.", 502);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch { return reply("Backend katalog tidak dapat dihubungi.", 503); }
}
export async function POST(request: Request, context: Context) {
  const { action } = await context.params;
  if (action !== "predict" && action !== "optimize") return reply("Endpoint tidak tersedia.", 404);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return reply("Gunakan JSON.", 415);
  const reader = request.body?.getReader();
  if (!reader) return reply("Input wajib diisi.", 422);
  let text = "", bytes = 0;
  const decoder = new TextDecoder();
  let payload: unknown;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > 16384) { await reader.cancel(); return reply("Input terlalu besar.", 413); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode(); payload = JSON.parse(text);
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return reply("Input harus berupa JSON object.", 422);
  } catch { return reply("Input JSON tidak valid.", 422); }
  // AI must never silently use the legacy Rescue-only development default.
  if (!process.env.SPONTAN_BACKEND_URL?.trim() && !process.env.FORMULARESCUE_API_URL?.trim()) return reply("Backend gabungan belum dikonfigurasi. Periksa binding Services atau API lokal.", 503);
  try {
    const response = await fetch(backendUrl("/ai-reformulation/" + action), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      cache: "no-store", redirect: "error", signal: AbortSignal.any([request.signal, AbortSignal.timeout(45000)]),
    });
    if (!response.ok) {
      const status = [413, 415, 422, 429, 503].includes(response.status) ? response.status : 502;
      return reply(status === 422 ? "Input atau baseline tidak valid. Periksa batas bahan dan target numerik." :
        status === 429 ? "Optimizer sedang penuh. Coba kembali sebentar lagi." : "AI backend belum dapat memproses request.", status);
    }
    const result: unknown = await response.json().catch(() => null);
    if (typeof result !== "object" || result === null || Array.isArray(result)) return reply("Respons AI backend tidak valid.", 502);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch { return reply("AI backend tidak dapat dihubungi atau waktu proses habis. Coba kembali.", 503); }
}
