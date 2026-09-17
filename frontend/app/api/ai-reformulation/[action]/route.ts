import { backendUrl } from "../../../../lib/server-backend";
type Context = { params: Promise<{ action: string }> };
export const runtime = "nodejs";
function reply(detail: string, status: number) {
  return Response.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
}
export async function GET(request: Request, context: Context) {
  const { action } = await context.params;
  if (action !== "products") return reply("Endpoint unavailable.", 404);
  if (!process.env.SPONTAN_BACKEND_URL?.trim() && !process.env.FORMULARESCUE_API_URL?.trim()) return reply("The combined engine is not configured. Check the Services binding or local API configuration.", 503);
  try {
    const response = await fetch(backendUrl("/ai-reformulation/products"), { cache: "no-store", redirect: "error",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]) });
    if (!response.ok) return reply("The engine product catalog is unavailable.", response.status === 503 ? 503 : 502);
    const result: unknown = await response.json().catch(() => null);
    if (typeof result !== "object" || result === null || Array.isArray(result)) return reply("Invalid engine catalog response.", 502);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch { return reply("The catalog engine could not be reached.", 503); }
}
export async function POST(request: Request, context: Context) {
  const { action } = await context.params;
  if (action !== "predict" && action !== "optimize") return reply("Endpoint unavailable.", 404);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return reply("Use JSON content.", 415);
  const reader = request.body?.getReader();
  if (!reader) return reply("Request body is required.", 422);
  let text = "", bytes = 0;
  const decoder = new TextDecoder();
  let payload: unknown;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > 16384) { await reader.cancel(); return reply("Request body is too large.", 413); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode(); payload = JSON.parse(text);
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return reply("Request body must be a JSON object.", 422);
  } catch { return reply("Invalid JSON request body.", 422); }
  // AI must never silently use the legacy Rescue-only development default.
  if (!process.env.SPONTAN_BACKEND_URL?.trim() && !process.env.FORMULARESCUE_API_URL?.trim()) return reply("The combined engine is not configured. Check the Services binding or local API configuration.", 503);
  try {
    const response = await fetch(backendUrl("/ai-reformulation/" + action), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      cache: "no-store", redirect: "error", signal: AbortSignal.any([request.signal, AbortSignal.timeout(45000)]),
    });
    if (!response.ok) {
      const status = [413, 415, 422, 429, 503].includes(response.status) ? response.status : 502;
      return reply(status === 422 ? "Invalid input or baseline. Check ingredient bounds and numerical targets." :
        status === 429 ? "The optimizer is busy. Please try again shortly." : "The AI engine could not process this request.", status);
    }
    const result: unknown = await response.json().catch(() => null);
    if (typeof result !== "object" || result === null || Array.isArray(result)) return reply("Invalid AI engine response.", 502);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch { return reply("The AI engine could not be reached or timed out. Please try again.", 503); }
}
