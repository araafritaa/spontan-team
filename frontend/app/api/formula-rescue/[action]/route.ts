// Only fixed FormulaRescue operations are forwarded. Never accept a target URL from users.
import { backendUrl } from "../../../../lib/server-backend";
type Context = { params: Promise<{ action: string }> };
export const runtime = "nodejs";

async function forward(path: string, method: string, body?: string) {
  try {
    const response = await fetch(backendUrl(path), {
      method, body, headers: body ? { "Content-Type": "application/json" } : undefined,
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(45000),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      const status = [422, 429, 503].includes(response.status) ? response.status : 502;
      return Response.json({ detail: status === 422 ? "Invalid formulation or ingredient. Check your selections." : status === 429 ? "Too many requests. Please try again later." : "The rescue engine could not process this request." }, { status });
    }
    if (!result) return Response.json({ detail: "Invalid engine response." }, { status: 502 });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ detail: "The engine could not be reached or timed out. Please try again." }, { status: 503 });
  }
}
export async function GET(request: Request, context: Context) {
  const { action } = await context.params;
  if (action === "health") return forward("/health", "GET");
  if (action === "ready") return forward("/ready", "GET");
  if (action !== "formulas") return Response.json({ detail: "Endpoint unavailable." }, { status: 404 });
  const query = new URL(request.url).searchParams;
  const offset = Number(query.get("offset") ?? 0), limit = Number(query.get("limit") ?? 100);
  if (!Number.isInteger(offset) || offset < 0 || offset > 10000 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    return Response.json({ detail: "Invalid pagination." }, { status: 422 });
  }
  return forward("/formulas?offset=" + offset + "&limit=" + limit, "GET");
}
export async function POST(request: Request, context: Context) {
  const { action } = await context.params;
  if (action !== "reformulate") return Response.json({ detail: "Endpoint unavailable." }, { status: 404 });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ detail: "Use JSON content." }, { status: 415 });
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ detail: "Request body is required." }, { status: 422 });
  let text = "", bytes = 0; const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > 8192) { await reader.cancel(); return Response.json({ detail: "Request body is too large." }, { status: 413 }); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const data = JSON.parse(text);
    if (!Number.isInteger(data.formula_id) || data.formula_id < 0 || data.constraint?.type !== "ingredient_unavailable" ||
      typeof data.constraint.ingredient !== "string" || !data.constraint.ingredient.trim() || data.constraint.ingredient.length > 200 ||
      !Number.isInteger(data.top_k) || data.top_k < 1 || data.top_k > 10) {
      return Response.json({ detail: "Invalid formulation, ingredient or candidate count." }, { status: 422 });
    }
    return forward("/reformulate", "POST", JSON.stringify({ formula_id: data.formula_id, constraint: { type: "ingredient_unavailable", ingredient: data.constraint.ingredient }, top_k: data.top_k }));
  } catch { return Response.json({ detail: "Invalid JSON request body." }, { status: 422 }); }
}
