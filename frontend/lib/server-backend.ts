// Server-side only: call from Route Handlers, never from client components.
// Services injects the binding at runtime, so do not capture it during build.
export function backendUrl(path: string): URL {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Invalid API path");
  const binding = process.env.SPONTAN_BACKEND_URL?.trim();
  const configured = process.env.FORMULARESCUE_API_URL?.trim();
  let base = binding || configured;
  if (!base && process.env.VERCEL === "1") throw new Error("Backend binding unavailable");
  base ||= "https://formula-rescue-api-gold.vercel.app"; // Legacy development fallback only.
  const url = new URL(base);
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && (binding || local))) {
    throw new Error("Invalid backend protocol");
  }
  if (url.username || url.password || url.search || url.hash) throw new Error("Invalid backend base URL");
  url.pathname = url.pathname.replace(/\/$/, "") + "/";
  return new URL(path.slice(1), url); // Keep any prefix in the generated service URL.
}
