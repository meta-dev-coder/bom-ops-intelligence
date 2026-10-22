# BOM Operations Intelligence — PoC

A deterministic CesiumJS command centre for Chhatrapati Shivaji Maharaj International Airport (BOM),
built to `Mumbai_Airport_Operations_Intelligence_PoC_Specification.docx` (SuperDNA, v1.0).

> Decision-support demonstration — **not** an operational airport, ATC or forecasting system. All
> passenger, forecourt, parking and scenario values are synthetic and labelled **SIMULATION**.

## Run

```bash
nvm use 22
npm install
cp .env.example .env.local   # add VITE_CESIUM_ION_TOKEN (and optional server keys)
npm run dev                  # http://localhost:5173
npm test                     # vitest — unit + component tests (model, scenario, fallback, alerts, roles, inspector)
npm run e2e                  # Playwright browser smoke test (first run: npx playwright install chromium)
npm run build                # typecheck + production build
```

Without an ion token the app still runs (Esri imagery on a flat ellipsoid, no 3D buildings).

## What it does

- **Map** — Cesium World Terrain + Google 2D satellite (ion) + Cesium OSM Buildings; Google
  Photorealistic 3D as an optional layer (never shown together with OSM Buildings).
  Selectable T1, T2, T2 MLCP, GA terminal, runways 09/27 & 14/32 and the Sahar Elevated Road
  (both directions) from `src/data/fixtures/bom-entities.geojson`.
- **Context-aware inspector** — KPIs depend on the selected entity type; every KPI has a unit,
  a LIVE/STALE/SIMULATION tag and a definition.
- **Scenario A** — monsoon squall + Sahar inbound blockage: rain 50 mm/h, road 5 km/h, T2
  Demand Pressure Index 42 (Moderate) → 86 (Severe), structured alert, exact reset.
- **Alerts** — observation, impact, factors, suggested actions (never executed), assumptions,
  provenance; acknowledge / assign / note / resolve gated by a demo role selector.
- **Two modes** (Settings; no badge on screen):
  - **Simulation** (default) — deterministic fixtures, every value tagged SIMULATION; used by the guided demo.
  - **Real data** — live feeds through the `/api` proxy (`server/`), with caching, timeouts and
    LIVE → STALE fallback:
    | Feed | Source | Key |
    |---|---|---|
    | Weather | METAR VABB, aviationweather.gov (NOAA) — rainfall rate estimated from the weather code | none |
    | Aircraft | adsb.lol live ADS-B within 40 nm (ODbL; credit on map), dead-reckoned between 15 s updates | none |
    | Flights | AeroDataBox BOM arrivals (passengers estimated from aircraft category) | `AERODATABOX_API_KEY` |
    | Roads | TomTom Traffic Flow | `TOMTOM_API_KEY` |
    | Weather (alt.) | Open-Meteo, replaces METAR when set | `OPEN_METEO_API_KEY` |

    In Real mode, values without a live source carry no tag; hovering their card reveals a neutral
    **ESTIMATE** tag (screen readers always hear it). Running a scenario brings SIMULATION tags back
    for the scripted values.

- **Guided demo** — first visit shows a start tile (guided demo or skip); 6 steps following the
  spec's presenter script with "Do it for me" and Skip/Back/Next. Reopen via **Guide**; `?intro=off` skips it.
- **Roles** — Supervisor edits model parameters and band thresholds; Administrator sets refresh
  interval and sees provider/geometry configuration (never keys); Demo Operator gets scenario
  diagnostics (downloadable run record), fixtures and "Reset environment".

## Hosting

GitHub Pages: https://meta-dev-coder.github.io/bom-ops-intelligence/ — built by
`.github/workflows/pages.yml` on every push to `main` (static, Mock Mode only; the ion token comes
from the `VITE_CESIUM_ION_TOKEN` Actions secret). Real mode needs the `/api` proxy (the providers
don't allow browser CORS), so on Pages it is unavailable unless the build sets `VITE_API_BASE` to an
external proxy (any Node host running `vite preview`, with `API_ALLOWED_ORIGIN=https://meta-dev-coder.github.io`).
EC2 (Real mode, password-protected): see [`deploy/ec2/README.md`](deploy/ec2/README.md).
Locally: `npm run dev` → Settings → role *Developer / Demo Operator* or *System Administrator* → Real data.

## Docs

- `docs/ASSUMPTIONS_REGISTER.md` — every model/fixture assumption, data-source plan, decisions to validate, sign-off
- `docs/ACCEPTANCE.md` — SC/FR acceptance checklist mapped to evidence
- `docs/DATA_SOURCES.md` — free / trial / licensed options for real BOM data

## Where things live

| Path | Role |
|---|---|
| `src/config/model.json` | All demand-pressure assumptions, thresholds, bands, severities |
| `src/simulation/demandPressure.ts` | Pure, transparent pressure model (spec §6.1) |
| `src/simulation/operationalState.ts` | Baseline + scenario + applied steps → everything shown |
| `src/simulation/ScenarioEngine.ts` | IDLE → RUNNING → ACTIVE → RESETTING state machine |
| `src/simulation/alertRules.ts` | Scenario result → structured recommendation |
| `src/data/fixtures/` | Baseline, scenario and geometry fixtures |
| `src/data/DataService.ts` | `resolveEnvelope` — the only LIVE/STALE/SIMULATION decision on the client |
| `server/` | Vite-mounted `/api` proxy + Open-Meteo / TomTom adapters |
| `src/map/` | Cesium scene, layers, central picker, camera, synthetic aircraft |
| `src/state/store.ts` | Zustand store; Cesium objects are never stored in it |
| `tools/build_entities.py` | Regenerates the entity GeoJSON from an OSM extract |
| `src/demo/` | Guided demo flow (pure step logic + UI) |
| `tests/`, `e2e/` | Vitest unit/component tests; Playwright smoke test |

## Geometry

Terminal, runway, car-park and road geometry is derived from OpenStreetMap (© OpenStreetMap
contributors, ODbL) and is **unreviewed** — every feature records its OSM way ids and
`reviewStatus`. Replace the GeoJSON with authorized GIS/CAD/BIM data when available.
To rebuild: fetch `api.openstreetmap.org/api/0.6/map` tiles over 72.835–72.89 E,
19.075–19.11 N into `tools/.osm_cache.json` (see the script header), then
`python3 tools/build_entities.py`.

## Licensing notes (re-check before any client demo)

- **Open-Meteo** free API: non-commercial only → disabled unless `OPEN_METEO_API_KEY` or
  `OPEN_METEO_ALLOW_FREE=true`. "Current" values are model nowcasts, labelled as such.
- **TomTom**: verify plan terms and coverage of the exact Sahar elevated segment. Responses whose
  geometry is > 40 m from our segment are rejected (`SEGMENT_MISMATCH`), not shown as LIVE.
- **OpenSky / Aviationstack**: not used — commercial use needs a licence; flights and aircraft are synthetic.
- **Google tiles via ion** count against the ion account's usage; keep Cesium's credit display visible.
