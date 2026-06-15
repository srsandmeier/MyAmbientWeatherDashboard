# Neighbor Data Research

Created: 2026-05-30
Status: Planning reference

## Summary

Owned-station data is supported by the official Ambient Weather APIs. Nearby public station discovery is
not documented in the official Ambient Weather API blueprint.

Neighbor data should therefore be treated as experimental and provider-driven:

1. Use the official Ambient REST/realtime APIs for the authenticated user's own stations.
2. Use Ambient's undocumented Open REST API only behind a feature flag and provider abstraction.
3. Support other public weather providers as fallbacks for nearby comparison where Ambient public station
   data is unavailable or changes.

## Official Ambient APIs

The official Ambient API docs expose:

- `GET /v1/devices` for the authenticated user's devices and latest `lastData`.
- `GET /v1/devices/{macAddress}` for the authenticated user's historical readings.
- The realtime Socket.IO API for devices tied to subscribed user API keys.

These APIs require `applicationKey` and/or user `apiKey` values and do not document a supported
neighbor/public-station discovery endpoint.

References:

- https://ambientweather.docs.apiary.io/
- https://raw.githubusercontent.com/ambient-weather/api-docs/master/apiary.apib
- https://github.com/ambient-weather/api-docs

## Ambient Undocumented Open REST API

The `aioambient` package documents a second, undocumented API used by the Ambient Weather web app.
It does not require Ambient API keys.

`aioambient` 2025.2.0 source inspection shows:

- Base URL: `https://lightning.ambientweather.net`.
- Nearby station discovery:
  - `GET /devices`.
  - Query parameters:
    - `$publicBox[0][0]` = southwest longitude.
    - `$publicBox[0][1]` = southwest latitude.
    - `$publicBox[1][0]` = northeast longitude.
    - `$publicBox[1][1]` = northeast latitude.
    - `$limit` = `100`.
  - `aioambient` computes the bounding box by shifting the requested latitude/longitude by a radius in
    miles.
  - Response shape is expected to be an object with a `data` array of device dictionaries.
- Public device current detail:
  - `GET /devices/{macAddress}`.
  - Response shape is expected to be one device dictionary.
- The open API response may not include computed `dewPoint` and `feelsLike`; `aioambient` computes those
  client-side when `tempf`, `humidity`, and `windspeedmph` are present.
- The shared request handler sleeps one second before every request, which implies the library authors
  still treat these calls as needing gentle rate limiting.

### Observed Postman Result

Tested discovery URL (generic bounding-box format — substitute your own coordinates):

```text
GET https://lightning.ambientweather.net/devices?$publicBox[0][0]={swLon}&$publicBox[0][1]={swLat}&$publicBox[1][0]={neLon}&$publicBox[1][1]={neLat}&$limit=1000
```

Observed response characteristics:

- Top-level shape is `{ "data": [...] }`.
- A typical ~7-mile bounding box returned ~50 public station rows.
- Most rows had `lastData.dateutc`; a minority were stale or missing.
- Public station detail can be tested by URL-encoding a MAC address from the discovery response:

```text
GET https://lightning.ambientweather.net/devices/{url-encoded-mac}
```

Important observed fields:

- Top-level station:
  - `_id`
  - `macAddress`
  - `lastData`
  - `info`
  - `tz`
  - sometimes `settings`
- Location:
  - `info.name`
  - `info.coords.coords.lat`
  - `info.coords.coords.lon`
  - `info.coords.location`
  - `info.coords.geo.coordinates`
  - `info.indoor`
  - `info.slug`
- Current reading:
  - `lastData.dateutc`
  - `lastData.dateutc5`
  - `lastData.created_at`
  - `lastData.tz`
  - `lastData.stationtype`
  - `lastData.tempf`
  - `lastData.humidity`
  - `lastData.windspeedmph`
  - `lastData.windgustmph`
  - `lastData.winddir`
  - `lastData.winddir_avg10m`
  - `lastData.baromrelin`
  - `lastData.baromabsin`
  - `lastData.hourlyrainin`
  - `lastData.dailyrainin`
  - `lastData.weeklyrainin`
  - `lastData.monthlyrainin`
  - `lastData.yearlyrainin`
  - `lastData.solarradiation`
  - `lastData.uv`
  - optional air-quality/lightning/extra-sensor fields

Implementation notes from the observed payload:

- Do not require every station to have `lastData.dateutc`; filter missing/stale rows.
- Use `maxAgeMinutes` from neighbor config before aggregation.
- Treat `lastData.hl`, `lastData.lightnings`, `lastData.discreets`, and `settings` as optional provider
  extras; do not need them for v1 current neighbor averaging.
- Do not store detailed address components unless a feature explicitly needs them. Prefer coordinates,
  station name, coarse location, provider, source ID, and freshness metadata.
- Store provider/source provenance because fallback providers will not have the same field shape.

References:

- https://github.com/bachya/aioambient
- https://pypi.org/project/aioambient/

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Undocumented endpoint changes or disappears | Neighbor feature breaks | Hide behind provider abstraction and feature flag; fail closed with friendly unavailable state |
| No published SLA or rate limit | Throttling/blocking possible | Cache aggressively, rate-limit refresh, avoid fan-out calls |
| Public station data only | Users may expect private station coverage | Label as public nearby comparison, not authoritative local truth |
| Current data only confirmed | Historical neighbor charts may be unavailable | Cache current neighbor samples over time or use another provider for historical comparison |
| Shape is untrusted | Runtime mapping errors | Validate JSON shape and ignore stations missing required fields |

## Public Provider Fallback Candidates

### Weather.gov / National Weather Service

- Public U.S. API with JSON and OpenAPI specification.
- Useful for U.S. nearest official observations and forecast context.
- Not a personal-weather-station network.
- Good fallback for official nearby observations in the United States.

References:

- https://www.weather.gov/documentation/services-web-api
- https://api.weather.gov/openapi.json

### NOAA NCEI Climate Data Online

- Free government climate/station data API.
- Requires a free token.
- Useful for station metadata and historical daily climate data.
- Not ideal for live dashboard neighbor comparisons.

Reference:

- https://www.ncei.noaa.gov/cdo-web/webservices/v2

### Open-Meteo

- Free/no-key weather API for non-commercial use.
- Global coverage with current, forecast, and historical model/reanalysis data.
- Not station-level neighbor data, but useful as a public fallback baseline at a coordinate.

Reference:

- https://open-meteo.com/en/docs

## Recommended Phase 11 Design

- Introduce an `INearbyWeatherProvider` abstraction instead of binding the product directly to Ambient's
  undocumented Open API.
- Add providers in this order:
  1. `AmbientOpenWeatherProvider` for public Ambient station discovery/current data, disabled by default
     until manually verified.
  2. `WeatherGovNearbyObservationProvider` for U.S. official observations where available.
  3. `OpenMeteoNearbyBaselineProvider` for global model-based fallback.
- Store provider name, station/source identifier, distance, last observed timestamp, and freshness in
  `neighbor_station_cache`.
- Keep `source=neighbors` as a user-facing concept, but internally record the provider and data quality.
- Treat historical neighbor charts as deferred unless:
  - A provider supports historical station observations safely, or
  - The app has cached enough neighbor current samples over time to build its own history.
- Keep all provider credentials, if any, server-side. Prefer no-key public APIs for v1.
