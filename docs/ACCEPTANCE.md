# Acceptance checklist — BOM Operations Intelligence PoC

Spec §12 and §2.3, mapped to evidence. Automated evidence runs with `npm test` (vitest: unit +
component) and `npm run e2e` (Playwright, headless WebGL). Status as of 22 Oct 2026.

## Success criteria (§2.3)

| ID | Criterion | Evidence | Status |
|---|---|---|---|
| SC-01 | Loads into the BOM scene without live APIs | `e2e/smoke.spec.ts` (Mock Mode, no provider keys); hosted Pages build is Mock-only | ✅ |
| SC-02 | Each configured entity opens the correct inspector | `tests/components.test.tsx` — T1, T2, road, runway, parking, generic facility, overview | ✅ |
| SC-03 | Scenario gives the same metrics every time | `tests/scenarioReset.test.ts`, `tests/scenarioResult.test.ts`; e2e run twice in browser session | ✅ |
| SC-04 | Every data panel shows LIVE / STALE / SIMULATION | `tests/components.test.tsx` ("every KPI card shows a data-state tag"); visual audit of panels | ✅ |
| SC-05 | Failed API doesn't crash or block the scenario | `tests/dataFallback.test.ts`, `tests/providers.test.ts`; LIVE mode with no keys falls back (checked in browser) | ✅ |
| SC-06 | Alert explains observation, impact, assumptions, recommendation | `tests/alertRules.test.ts`, `tests/components.test.tsx` (AlertCenter) | ✅ |
| SC-07 | Reset restores metrics, overlays, alerts, aircraft | `tests/scenarioReset.test.ts`, `e2e/smoke.spec.ts`; aircraft clock reset via `aircraftResetNonce` | ✅ |

## Functional requirements (§12)

| ID | Requirement | Evidence | Status |
|---|---|---|---|
| FR-01 | Load BOM scene at configured coordinates | `src/config/airport.ts`; e2e canvas check; screenshots | ✅ |
| FR-02 | Imagery, terrain, OSM buildings; graceful degrade; attribution | `src/map/scene.ts` (per-layer status, no-token fallback), credits kept visible | ✅ |
| FR-03 | Select T1, T2, road, runway, facility | Central picker `src/map/SelectionController.ts`; component + e2e tests | ✅ |
| FR-04 | KPI unit, state tag, definition | `KpiCard` + component test | ✅ |
| FR-05 | Weather, traffic, flight board offline | Fixtures; e2e runs with no network keys | ✅ |
| FR-06 | Deterministic aircraft | `tests/aircraftPaths.test.ts` | ✅ |
| FR-07 | Scenario A coherent sequence | Step machine + e2e | ✅ |
| FR-08 | Transparent pressure calc; normal/elevated/severe/zero-capacity tests | `tests/demandPressure.test.ts` | ✅ |
| FR-09 | Reset to exact baseline | `tests/scenarioReset.test.ts`, e2e | ✅ |
| FR-10 | Failures → STALE/SIMULATION, never false LIVE | `tests/dataFallback.test.ts`, `tests/providers.test.ts` | ✅ |
| FR-11 | Alert detail, acknowledge, focus entity | Component test; "View on map" focuses entity | ✅ |
| FR-12 | Role-dependent actions | `tests/roles.test.ts`, `tests/store.test.ts`, component tests | ✅ |
| FR-13 | Desktop + tablet drawer layout | Implemented (lg: side rails; <lg: drawers; <md: one panel) | ⚠️ Manual check pending on a tablet |
| FR-14 | Data provenance panel | `DataSourceHealth`, alert provenance block | ✅ |
| FR-15 | No operational action execution | No outbound command/notification code; advisory wording guarded by `tests/alertRules.test.ts` | ✅ |

## Non-functional (§13) highlights

| Item | Evidence | Status |
|---|---|---|
| Secrets server-side, redacted in logs | `server/providerService.ts` `redact()` + test; keys never `VITE_` | ✅ |
| Timeouts, retry/backoff, no parallel polling | `providerService` (in-flight de-dup, test), single `useLiveData` loop | ✅ |
| Reduced motion, keyboard focus, non-colour status | Settings toggle + `prefers-reduced-motion`; glyph + text tags | ✅ |
| Event log of scenario, reset, acknowledgement, config changes | Event history panel; `tests/store.test.ts` | ✅ (session only — no backend) |
| HTTPS deployment | GitHub Pages | ✅ |

## Out of scope / deferred

- Scenario B (runway closure) — deferred by decision (21 Oct 2026).
- Live aircraft and flight schedule providers — licensing (see `docs/DATA_SOURCES.md`).
- Production authentication, persistence, audit — spec §2.2 non-goals.
