# Assumptions register — BOM Operations Intelligence PoC

Spec §14 P0 exit criterion: *"Signed-off assumptions register and source plan."*
Every value below is a **demo assumption**, not validated airport data. All are configurable
(`src/config/model.json`, `src/data/fixtures/*`) and shown in the UI wherever they are used.

## A. Demand-pressure model (`src/config/model.json`, spec §6.1)

| ID | Assumption | Value | Used for | Owner to validate | Status |
|---|---|---|---|---|---|
| M-01 | Time window | 30 min | Arrival demand, pressure window | Airport landside ops | Proposed |
| M-02 | Share of arriving passengers needing kerbside pickup | 40 % | Pickup vehicles | Airport landside ops | Proposed |
| M-03 | Passengers per pickup vehicle | 2.0 | Pickup vehicles | Airport landside ops | Proposed |
| M-04 | Baseline forecourt processing capacity (T2) | 1,400 vehicles/h | Effective capacity | Airport landside ops | Proposed |
| M-05 | Road capacity factor = floor + (1 − floor) × speed ratio, floor | 0.5 | Road impact on capacity | Traffic / landside | Proposed |
| M-06 | Rainfall capacity factors | ≥0 → ×1.0, ≥2.5 → ×0.95, ≥10 → ×0.88, ≥35 mm/h → ×0.75 | Weather impact | Ops + Met | Proposed |
| M-07 | Index scale: ratio ÷ 1.6 × 100, capped at 100 | 1.6 | Demand Pressure Index | Product | Proposed |
| M-08 | Index bands | Low <30, Moderate 30–59, High 60–79, Severe ≥80 | Band, alert trigger | Ops supervisor | Proposed (editable by Supervisor) |
| M-09 | Alert raised at band | High and above | Recommendation alert | Ops supervisor | Proposed |
| M-10 | Severity mapping | High → WARNING, Severe → HIGH | Alert severity | Ops supervisor | Proposed |
| M-11 | Dispatch-delay rule | 4 min base + excess ÷ capacity per min | Illustrative delay only | Product | Proposed — not a queue model |
| M-12 | Road status thresholds (speed ratio) | ≥0.85 free, ≥0.6 moderate, ≥0.35 heavy, ≥0.15 severe, else blocked | Live traffic status | Traffic | Proposed |

## B. Baseline fixture (`src/data/fixtures/bom-baseline.json`, spec Appendix B.1)

| ID | Item | Value | Note |
|---|---|---|---|
| F-01 | Data window | 21 Oct 2026, 18:30 IST, 15 min | Synthetic evening peak |
| F-02 | Weather | 29 °C, wind 14 km/h SW, rain 0 mm/h | Illustrative |
| F-03 | Sahar inbound / outbound | 32 / 39 km/h, free-flow 45 km/h | Not measured |
| F-04 | Nehru Road (T1 approach) | 22 km/h, free-flow 35 km/h | Not measured |
| F-05 | T2 arrivals next 30 min | 4 widebody, seats 370–380 × load factor 0.80 = 1,200 pax | Flight numbers prefixed DEMO |
| F-06 | T1 arrivals next 30 min | 3 flights (2 narrowbody, 1 regional) | Synthetic |
| F-07 | Departing drop-off vehicles in window | T2 160, T1 70 | Synthetic |
| F-08 | Cab staging | T2 120/200, T1 64/120 | Configured demo values |
| F-09 | Apron stands (T1) | 31/46 | Synthetic |
| F-10 | T2 MLCP | 2,650 occupied / 4,000 assumed capacity | Not verified capacity |
| F-11 | Aircraft tracks | 5 arrivals, 3 departures on runway 27, straight 3° approach / climb-out | Not flight plans |

## C. Scenario A (`src/data/fixtures/bom-scenario-monsoon.json`, spec §8.1)

| ID | Scripted input | Value |
|---|---|---|
| S-01 | Rainfall | 50 mm/h, wind 46 km/h, 25 °C |
| S-02 | Sahar inbound speed | 5 km/h, BLOCKED |
| S-03 | T2 cab staging during scenario | 188/200 |
| S-04 | Expected outcome | T2 index 42 (Moderate) → 86 (Severe) — guarded by `tests/demandPressure.test.ts` |

## D. Geometry (spec §5.1, §5.3)

| ID | Item | Source | Status |
|---|---|---|---|
| G-01 | T1, T2, T2 MLCP, GA terminal polygons | OpenStreetMap ways (ODbL), ids in GeoJSON | Visually aligned with Google satellite imagery; **not reviewed against airport plans** |
| G-02 | Runways 09/27, 14/32 | OSM centrelines buffered to 60 m / 45 m | Lengths 3,372 m / 2,868 m (published 3,445 / 2,925 m) |
| G-03 | Sahar Elevated Road (both directions), Nehru Road | OSM ways | Clamped to ground; elevated section not modelled in 3D |

## E. Data-source plan (spec §7, §15)

| Source | Use | Default | Decision needed |
|---|---|---|---|
| Cesium ion (terrain, OSM Buildings, Google 2D / Photoreal) | Base map | On | Ion usage quota for public demos |
| Open-Meteo | Live weather | Off (needs licence or `OPEN_METEO_ALLOW_FREE`) | Commercial plan, or switch to aviationweather.gov METAR (see DATA_SOURCES.md) |
| TomTom Traffic Flow | Live road speed | Off (needs key) | Licence terms and Sahar segment coverage |
| Flight schedule, aircraft positions | — | Synthetic | Licensed provider (see DATA_SOURCES.md) |
| Passenger, forecourt, parking, stands | — | Synthetic | Airport-provided figures |

## F. Decisions to validate (spec §15)

| Topic | Current assumption | Validation needed | Status |
|---|---|---|---|
| Airport geometry | OSM-derived, unreviewed | Footprints vs authorized plans | Open |
| Traffic | TomTom candidate | Segment response + licence | Open |
| Weather | Mock default; Open-Meteo adapter | Provider with commercial rights | Open |
| Flight data | Synthetic | Provider + fields + terms | Open |
| Passenger assumptions | Section A | Ops sign-off | Open |
| Recommendations | Illustrative, advisory wording | Airport procedures | Open |
| User roles | Demo selector | Production identity design | Deferred (out of MVP) |
| Runway scenario (B) | Not built | Scope decision | Deferred (decided 21 Oct 2026) |

## Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Airport operations | | | |
| Solution architect | | | |
| SuperDNA product owner | | | |
