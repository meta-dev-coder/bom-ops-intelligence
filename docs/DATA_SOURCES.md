# Real data for BOM — free, open and trial options

Researched 22 Oct 2026 from providers' own pricing/terms pages where reachable. **Re-check terms
before any client demo** — several items could only be verified second-hand (marked ⚠).
The demo is commercial, so "free for non-commercial use" does not qualify.

## Usable free for a commercial demo

| Need | Source | Free limit | Catch |
|---|---|---|---|
| Weather (METAR/TAF for VABB) | aviationweather.gov (NOAA AWC) — https://aviationweather.gov/data/api/ | 100 req/min, no key | US-government data, normally public domain (no explicit licence page found ⚠) |
| Weather (conditions/forecast) | OpenWeather — https://openweathermap.org/full-price | 1M calls/month, One Call 1,000/day | Commercial OK under ODbL; must show "Weather data © OpenWeather" |
| Airport geometry | OpenStreetMap (ODbL) — https://www.openstreetmap.org/copyright | — | Attribution; share-alike only if you redistribute a derived database |
| Airport reference data | OurAirports — https://ourairports.com/data/ | — | Public domain |
| Passenger statistics | data.gov.in (MoCA/AAI monthly by city) — GODL-India | — | Monthly/annual only; attribution required (licence wording ⚠) |
| Live aircraft positions | adsb.lol — https://www.adsb.lol/docs/open-data/api/ | No key | ODbL, commercial OK with attribution; coverage over Mumbai is sparse (5 aircraft within 50 nm at 20:00 IST) |
| Road travel times | Google Routes API (India) — https://mapsplatform.google.com/pricing/ | ~35k Compute Routes Pro calls/month | Travel time per route, not segment speed; caching restricted; Google attribution |
| Road segment speed | TomTom Traffic Flow — https://docs.tomtom.com/pricing | 20k requests/month | Commercial use on free tier not stated ⚠ — get it in writing; no caching |

## Free or trial, but NOT for commercial use (or unverified)

- **Flight schedules:** Aviationstack free plan (100 calls/month, non-commercial); AeroDataBox RapidAPI trial (non-commercial); FlightAware AeroAPI Personal (personal/academic only); Cirium FlightStats 30-day evaluation (development use); OAG trial (14 days / 100 hits); FlightRadar24 sandbox ⚠; AirLabs ⚠.
- **ADS-B:** OpenSky (internal evaluation only — client demos need a licence); adsb.fi and airplanes.live (non-commercial); ADS-B Exchange RapidAPI (non-commercial).
- **Weather:** Open-Meteo free tier (non-commercial); IMD API (registration, likely non-commercial ⚠); CheckWX (terms silent — ask).
- **Charts:** AAI eAIP VABB charts — free to view, "All Rights Reserved": reference only, don't redistribute.

## Cheapest licensed option where free won't do

- **Flight schedules / FIDS for BOM:** AeroDataBox via API.market Pro ≈ US$7.50/month (5,000 units), commercial use permitted — the cheapest found.

## Recommended stack for this PoC

1. Weather → aviationweather.gov METAR for VABB (+ OpenWeather with attribution if forecasts are needed).
2. Geometry → OSM + OurAirports (already used).
3. Statistics → data.gov.in monthly BOM passengers (context only, not real-time).
4. Aircraft → adsb.lol with ODbL attribution, falling back to synthetic tracks (coverage is thin).
5. Road → Google Routes travel time on the Sahar approach, or TomTom once terms are confirmed.
6. Flights → AeroDataBox paid (~$7.50/month), else keep synthetic.

Passenger counts, forecourt/cab-staging capacity, parking and stand occupancy have **no public source** — they need the airport.
