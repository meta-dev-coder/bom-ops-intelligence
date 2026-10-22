# CLAUDE.md

BOM Operations Intelligence PoC — React 18 + TypeScript + Vite 6 + Tailwind 4 + plain CesiumJS + Zustand.
Spec: `~/Downloads/Mumbai_Airport_Operations_Intelligence_PoC_Specification.docx`. See README.md.

## Commands
- `npm run dev` (port 5173, mounts `/api` proxy) · `npm test` (vitest) · `npm run build` (tsc + vite)
- Node 22.

## Rules
- Nothing scoring-related is hardcoded: assumptions/thresholds live in `src/config/model.json`.
  The spec's 42 → 86 example must come out of the model — `tests/demandPressure.test.ts` guards it.
- Scenario state is always derived from the untouched baseline (`deriveOperationalState`); never mutate baseline.
- Every displayed value carries LIVE / STALE / SIMULATION. Only `resolveEnvelope` (client) and
  `providerService` (server) decide state; a failure must never be shown as LIVE.
- Recommendations are suggestions for human review. Don't add wording that asserts real queue times,
  closures, capacity breaches, MLCP levels, CISF moves or notifications (`tests/alertRules.test.ts`).
- Cesium objects never go in the store or React state. Map modules subscribe to the store in
  `src/map/MapController.ts`; there is one picker (`SelectionController.ts`).
- Ground outlines use clamped polylines (clamped polygon outlines are 1 px). Don't show OSM Buildings
  and Google Photorealistic together.
- Secrets: `.env.local` only. Provider keys are server-side (no `VITE_` prefix). Never print or commit them.

## Lessons carried over from acs-demo/cesium-poc
- Cesium assets are static-copied with an explicit `CESIUM_BASE_URL` (vite-plugin-cesium broke under a sub-path).
- A background/hidden Chrome tab doesn't render WebGL — a black globe in automation usually means the window isn't focused.
