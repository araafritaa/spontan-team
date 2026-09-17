# Frontend Instructions

Inherit root AGENTS.md. Read PROJECT_SPEC.md and docs/API_CONTRACT.md before changing UI/types.

- Stack default: Next.js + TypeScript + Tailwind only when scaffolding requested; this folder currently has no runnable app.
- Once installed, follow version-matched Next.js docs/instructions shipped with that version. Do not overwrite generated instructions without reading them.
- Keep first UI to input -> run -> output. Add only features required by the agreed demo.
- Work from agreed typed fixtures while backend is built; clearly label mock data. Never fabricate successful inference or process completion.
- Backend owns prediction/preprocessing/business rules; frontend handles input and rendering.
- Show idle, loading, success, validation error, server/network error, and empty states. Do not hide failures by falling back to mock predictions.
- Browser API calls use same-origin Route Handlers. In Vercel Services, only
  server code reads the generated `SPONTAN_BACKEND_URL` binding; local/legacy
  override is `FORMULARESCUE_API_URL`. Never expose either through `NEXT_PUBLIC_`.
- Explain uncertainty/score meaning from the contract. Do not label ranking score as calibrated confidence.
- Render user/model content safely; do not use raw HTML injection for untrusted output.
- Use accessible labels, keyboard controls, legible responsive layouts; test mobile. Disable repeat submissions while a request is pending; this is not server rate limiting.
- Do not add components/packages solely for decoration. Preserve existing design unless refinement requested.
- Verify typecheck/build, mock fixture, actual endpoint integration, error states, and real browser flow. Successful build alone does not prove requests work.
- Environment variable changes used in browser code require a fresh build/deployment; verify actual production origin with CORS.
