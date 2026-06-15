# API Reference — Ambient Weather

Base REST URL: `https://rt.ambientweather.net/v1`
Realtime Socket.IO: `https://rt2.ambientweather.net/?api=1&applicationKey=...`

Authentication requires two keys on every request:
- `applicationKey` — identifies the developer / app
- `apiKey` — identifies the user (grants read-only access to their devices)

---

## Rate limits

| Scope | Limit |
|---|---|
| Per API key | 1 request / second |
| Per application key | 3 requests / second |

Always use a rate-limit queue in the API client layer. Exceeding limits returns HTTP 429.

---

## Endpoints

### GET /v1/devices
Returns all devices for the authenticated user. Each device includes a `lastData` object
with the most recent reading (updated ~every minute).

```
GET https://rt.ambientweather.net/v1/devices
  ?applicationKey=...
  &apiKey=...
```

Use this endpoint for **live current readings**. The `lastData` field is the freshest data
available. There can be up to a 10-minute delay before recent data appears in the history
endpoint — always prefer `/devices` for the current tile display.

### GET /v1/devices/:macAddress
Returns historical data for a specific device in 5-minute or 30-minute increments.

```
GET https://rt.ambientweather.net/v1/devices/{macAddress}
  ?applicationKey=...
  &apiKey=...
  &limit=288        # max records to return (288 × 5 min = 24 h)
  &endDate=...      # ISO 8601 timestamp — returns data UP TO this time
```

Page backwards through history by setting `endDate` to the oldest timestamp from the
previous page. Cache results in SQLite to avoid re-fetching.

---

## Realtime API (Socket.IO)

Endpoint: `https://rt2.ambientweather.net/?api=1&applicationKey={appKey}`

After connecting, subscribe with:
```json
{ "apiKeys": ["your-api-key"] }
```

The server emits a `data` event for each update from any device on the account.
Use this instead of polling for always-current tile values.

Note: the realtime subdomain is `rt2`, the REST subdomain is `rt` — don't mix them.

---

## Key device data fields

### Temperature
| Field | Description | Unit |
|---|---|---|
| `tempf` | Outdoor temperature | °F |
| `tempinf` | Indoor temperature | °F |
| `feelsLike` | Heat index or wind chill (server-calculated) | °F |
| `dewPoint` | Dew point (server-calculated) | °F |

### Humidity
| Field | Description | Unit |
|---|---|---|
| `humidity` | Outdoor humidity | % (0–100) |
| `humidityin` | Indoor humidity | % (0–100) |

### Pressure
| Field | Description | Unit |
|---|---|---|
| `baromrelin` | Relative (sea-level) pressure | inHg |
| `baromabsin` | Absolute (station) pressure | inHg |

### Wind
| Field | Description | Unit |
|---|---|---|
| `winddir` | Instantaneous direction | degrees (0–360) |
| `windspeedmph` | Instantaneous speed | mph |
| `windgustmph` | Max speed in last 10 minutes | mph |
| `maxdailygust` | Max speed in last day | mph |
| `windspdmph_avg2m` | 2-minute average speed | mph |
| `winddir_avg2m` | 2-minute average direction | degrees |
| `windspdmph_avg10m` | 10-minute average speed | mph |
| `winddir_avg10m` | 10-minute average direction | degrees |

### Solar / UV
| Field | Description | Unit |
|---|---|---|
| `uv` | UV index | integer |
| `solarradiation` | Solar radiation | W/m² |

### Rainfall
| Field | Description | Unit |
|---|---|---|
| `eventrainin` | Rainfall in current/last event | in |
| `hourlyrainin` | Hourly rain rate | in/hr |
| `dailyrainin` | Rain today | in |
| `24hourrainin` | Rain in last 24 hours | in |
| `weeklyrainin` | Rain this week | in |
| `monthlyrainin` | Rain this month | in |
| `yearlyrainin` | Rain this year | in |
| `totalrainin` | Total since factory reset | in |
| `lastRain` | Timestamp of last rain (server-calculated) | datetime |

### Timestamps
| Field | Description |
|---|---|
| `dateutc` | Unix timestamp in milliseconds (rounded to nearest minute) |
| `date` | Human-readable date string (server-converted) |
| `tz` | IANA timezone string |

---

---

## BFF Metric History Endpoint (Phase 8)

The dashboard's own BFF exposes a chart-ready metric history route that pages Ambient
history internally, caches pages in Redis, and never exposes Ambient credentials to the browser.

### GET /api/metrics/{metricKey}/history

```
GET /api/metrics/{metricKey}/history
  ?range=24h            # preset: 24h | 7d | 30d | 90d | 1y | custom | date
  &from=2026-05-01T00:00:00Z  # required when range=custom
  &to=2026-05-07T23:59:59Z    # required when range=custom
  &date=2026-05-29       # required when range=date (YYYY-MM-DD)
  &granularity=auto      # auto | raw | hour | day
  &deviceId={ownedDeviceId} # optional: owned device id; omit to use default station
  &source=my             # metric history currently supports only "my"; neighbor history is deferred
Authorization: Bearer {jwt}
```

Metric Detail comparison overlays use this same endpoint with a different owned `deviceId`.
The frontend exposes this as a `Compare` selector for other owned Ambient stations; selecting a
station issues a second history request with that station's `deviceId` and overlays the returned
series on the same chart.
Weather.gov, Open-Meteo, Ambient Open pinned stations, and neighbor aggregate sources do not
provide chart-history overlays in v1. The UI keeps those provider overlay controls unavailable
until a provider has historical observations or the app has cached enough samples to build an
honest time series.

Metric Detail renders an ECharts history chart plus a collapsible data-table alternative. The
table is local UI state only; it does not change the API contract. Chart controls use the same
query parameters shown above: rolling `range`, single-day `date`, `granularity`, and optional owned
`deviceId`.

**Supported metric keys:** `outdoor_temp`, `indoor_temp`, `outdoor_humidity`,
`indoor_humidity`, `pressure`, `uv_index`, `solar_radiation`, `wind_speed`,
`rainfall_event`, `rainfall_day`, `rainfall_week`, `rainfall_month`, `rainfall_year`.

**`auto` granularity rules:**
- ≤ 48 h → `raw` (all 5-min readings)
- ≤ 30 d → `hour` (average per hour; rainfall summed)
- \> 30 d → `day` (average per day; rainfall summed)

**`date` mode:** Falls back to UTC day boundaries (`00:00:00Z`–`23:59:59.999Z`) until
per-user timezone support is added in a later phase.

Readings with missing/null sensor values are skipped in the returned `points` array. The
`warnings` collection explains when data was unavailable, partially missing, or potentially
incomplete because a paging guard was reached.

**Example 200 response:**

```json
{
  "metricKey": "outdoor_temp",
  "deviceId": "{ownedDeviceId}",
  "deviceName": "{stationName}",
  "range": "date",
  "fromUtc": "2026-05-29T00:00:00Z",
  "toUtc": "2026-05-29T23:59:59.9999999Z",
  "granularity": "raw",
  "unit": "F",
  "points": [
    { "timestampUtc": "2026-05-29T12:00:00Z", "value": 72.4 },
    { "timestampUtc": "2026-05-29T12:05:00Z", "value": 72.6 }
  ],
  "warnings": []
}
```

**Error codes:**

| Status | Condition |
|---|---|
| 400 | Invalid `metricKey`, `range`, `date` format, or MAC address |
| 401 | Missing or invalid JWT |
| 404 | Explicit `deviceId` not found or not owned by the requesting user |
| 428 | Ambient credentials not configured, or no station has been synced |
| 429 | Ambient API rate limit exceeded |
| 503 | Ambient API unavailable (circuit breaker open) |

**Cache behavior:**
- Individual Ambient history pages are cached by `{userHash}/{mac}/{endDateEpochMs}/{limit}`.
- TTL: 15 minutes for pages with `endDate` within the last 24 hours; 6 hours for older pages.
- Cache misses route through `RateLimitedApiClient` (1 req/s per API key).

---

## Dashboard — current reading (Phase 9+)

### `GET /api/dashboard/current`

Returns the latest sensor reading for the user's primary station. Phase 11 also supports
`source=neighbors` for an aggregated nearby public-station reading.

```
GET /api/dashboard/current?source=my
Authorization: Bearer {jwt}
```

**Own-station resolution order:**
1. Latest-reading Redis cache key `latest-reading:{userHash}:{mac}` (5-minute TTL).
2. Ambient REST `GET /v1/devices` on cache miss; result is cached for the next request.

**Neighbor source:** `GET /api/dashboard/current?source=neighbors` reads the user's neighbor
configuration, resolves the default station coordinates, discovers/caches nearby public stations,
and returns mean aggregates with `source: "neighbors"`.

**Example 200 response:**

```json
{
  "deviceId": "{ownedDeviceId}",
  "deviceName": "{stationName}",
  "timestampUtc": "2026-05-31T12:00:00Z",
  "receivedAtUtc": "2026-05-31T12:00:01Z",
  "tempF": 72.4,
  "humidity": 62,
  "windSpeedMph": 5.0,
  "windDir": 180,
  "dailyRainIn": 0.1,
  "baromRelIn": 29.92
}
```

All nullable sensor fields (`tempF`, `humidity`, `windSpeedMph`, etc.) are `null` when the
station did not report that sensor. `receivedAtUtc` reflects when the backend received or
cached the value and can be used by the UI to show stale/offline states.

**Error codes:**

| Status | Condition |
|---|---|
| 401 | Missing or invalid JWT |
| 428 | No Ambient credentials/station for own-source, or neighbor comparison disabled/no coordinates/no stations for neighbor-source |
| 429 | Ambient rate limit exceeded (REST fallback path) |
| 503 | Ambient circuit breaker open (REST fallback path) |

---

## Neighbors — public station comparison (Phase 11)

All neighbor endpoints are authenticated and user-scoped. Ambient keys never reach the browser.

### `GET /api/neighbors/config`

Returns neighbor comparison settings, provider availability, and pinned stations.

### `PUT /api/neighbors/config`

Saves neighbor comparison settings. Validation covers radius, max observation age, minimum station
count, refresh interval, allowed providers, and pinned station provider/source/label bounds.

### `POST /api/neighbors/refresh`

Invalidates the cached station list, rediscovering nearby public stations from enabled providers.

### `GET /api/neighbors/stations/current`

```
GET /api/neighbors/stations/current?provider=WeatherGov&sourceId={sourceId}
Authorization: Bearer {jwt}
```

Returns the most recently cached reading for a pinned station. A 404 means the station is not in
the user's current neighbor cache and the user should refresh nearby stations.

| Status | Condition |
|---|---|
| 200 | Neighbor config or station reading returned |
| 400 | Invalid config payload |
| 401 | Missing or invalid JWT |
| 404 | Requested pinned station not present in the user's cache |
| 428 | Neighbor comparison disabled or station coordinates unavailable |
| 429 | Rate limit exceeded |

---

## Public Sources — selected station catalog (Phase 11 Section 8A)

All public source endpoints are authenticated and user-scoped. They store selected Weather.gov
or Open-Meteo sources for Default and Custom layout selection. Current-reading resolution is
available for saved, user-owned source ids.

### `GET /api/public-sources`

Returns public weather sources selected by the authenticated user.

### `GET /api/public-sources/discover?q={query}`

Searches for candidate public weather sources by zipcode or city/state text. The endpoint geocodes
the query, returns nearby Weather.gov observation stations where available, and includes an
Open-Meteo source candidate for the resolved location. Results may be empty when a provider is
unavailable or no supported source is found.

### `GET /api/public-sources/{id}/current`

Returns a current reading for a saved public source owned by the authenticated user. Weather.gov
sources resolve from the selected NWS station identifier; Open-Meteo sources resolve from saved
coordinates. Results are cached for 2 minutes and return the shared `CurrentReadingDto` shape
with `source: "public"`.

### `POST /api/public-sources`

Creates a selected public weather source.

| Field | Description |
|---|---|
| `provider` | `WeatherGov` or `OpenMeteo` |
| `sourceId` | Provider-specific source identifier |
| `displayLabel` | User-facing selected-location label |
| `latitude` / `longitude` | Selected source coordinates |
| `timezone` | Optional IANA timezone |
| `isEnabled` | Whether the source is available to layouts |
| `selectedMetricKeys` | Optional ordered metric-key list for Default/Custom layout display; `null` means all provider-supported metrics |

Allowed providers are `WeatherGov` and `OpenMeteo`. Latitude must be between -90 and 90;
longitude must be between -180 and 180. `sourceId` and `displayLabel` are capped at 128
characters.

### `PUT /api/public-sources/{id}`

Patch-style update for user-managed source settings.

```json
{
  "displayLabel": "{selectedLocationLabel}",
  "isEnabled": false,
  "selectedMetricKeys": ["outdoor_temp", "outdoor_humidity", "wind_speed"]
}
```

`selectedMetricKeys` is optional on create/update. When omitted, the existing selection is
preserved on update; when `null` or unset on a saved source, the frontend treats the source as
using all provider-supported public-source metrics.

### `DELETE /api/public-sources/{id}`

Deletes a selected public weather source.

| Status | Condition |
|---|---|
| 200 | Source updated |
| 201 | Source created |
| 204 | Source deleted |
| 400 | Validation failure |
| 401 | Missing or invalid JWT |
| 404 | Requested source is not owned by the authenticated user |
| 429 | Rate limit exceeded |

---

## Alerts — active public weather alerts (Phase 11 Section 8B)

### `GET /api/alerts/active`

Returns active Weather.gov/NWS alerts for the authenticated user's default station area.
The backend queries `api.weather.gov/alerts/active?point={lat},{lon}&status=actual` when
station coordinates are available and inside Weather.gov coverage. Results are cached for
2 minutes by user and point. Missing coordinates, outside-coverage coordinates, or transient
Weather.gov failures return an empty list.

Pass `area={code}` to request alerts for a selected Weather.gov area, zone, or state code
instead of the default station point. Area-code results use the same 2-minute cache window
and are isolated by authenticated user.

```json
[
  {
    "id": "{providerAlertId}",
    "event": "{alertEvent}",
    "headline": "{alertHeadline}",
    "description": "{alertDescription}",
    "severity": "Severe",
    "urgency": "Immediate",
    "certainty": "Likely",
    "effectiveUtc": "2026-06-05T20:00:00Z",
    "expiresUtc": "2026-06-05T22:00:00Z",
    "areaDesc": "{affectedArea}"
  }
]
```

| Status | Condition |
|---|---|
| 200 | Alert list returned, possibly empty |
| 401 | Missing or invalid JWT |
| 429 | Rate limit exceeded |

---

---

## Dashboard — daily temperature extrema (pre-Phase 11)

### `GET /api/dashboard/daily-extremes`

Returns the daily high/low outdoor and indoor temperatures for the user's default station,
computed from stored `WeatherReading` rows for the current UTC calendar day.

```
GET /api/dashboard/daily-extremes
Authorization: Bearer {jwt}
```

**Example 200 response:**

```json
{
  "deviceId": "{ownedDeviceId}",
  "deviceName": "{stationName}",
  "dateUtc": "2026-06-03T00:00:00Z",
  "dailyHighTempF": 92.3,
  "dailyLowTempF": 68.1,
  "dailyHighTempInF": 74.5,
  "dailyLowTempInF": 65.0
}
```

All temperature values in °F. Any field is `null` when no readings with a valid sensor value
exist for today. Callers should treat `null` as "no data yet" rather than zero.

**Note:** These values are computed from locally stored readings, not fetched from Ambient.
They reset at UTC midnight. A Phase 11 preference will allow switching to local-time midnight.

| Status | Condition |
|---|---|
| 200 | Extrema returned (fields may be null) |
| 401 | Missing or invalid JWT |
| 428 | No credentials saved or no station configured |
| 429 | Rate limit exceeded |

---

## Dashboard — rainfall (Phase 10+)

### `GET /api/dashboard/rainfall`

Returns rainfall accumulation fields for the user's primary station.

```
GET /api/dashboard/rainfall
Authorization: Bearer {jwt}
```

**Resolution order:** same as `/current` — latest-reading Redis cache, then Ambient REST fallback.

**Example 200 response:**

```json
{
  "deviceId": "{ownedDeviceId}",
  "deviceName": "{stationName}",
  "timestampUtc": "2026-06-01T12:00:00Z",
  "receivedAtUtc": "2026-06-01T12:00:01Z",
  "eventRainIn": 0.10,
  "dailyRainIn": 0.25,
  "weeklyRainIn": 1.00,
  "monthlyRainIn": 3.00,
  "yearlyRainIn": 18.00,
  "lastRain": "2026-06-01T10:30:00Z"
}
```

| Status | Condition |
|---|---|
| 401 | Missing or invalid JWT |
| 428 | No credentials or no station synced |

---

## Dashboard — layout (Phase 10+)

### `GET /api/dashboard/layout`

Returns the user's active dashboard layout. Seeds a Default layout on first access.

```
GET /api/dashboard/layout
Authorization: Bearer {jwt}
```

**Example 200 response (Default mode):**

```json
{
  "id": "...",
  "name": "Default",
  "layoutMode": "default",
  "tiles": [
    { "i": "temperature-{ownedDeviceId}", "x": 0, "y": 0, "w": 4, "h": 4,
      "type": "temperature", "deviceId": "{ownedDeviceId}" }
  ],
  "customItems": [],
  "updatedAtUtc": "2026-06-01T12:00:00Z"
}
```

**Example 200 response (Custom mode):**

```json
{
  "layoutMode": "custom",
  "tiles": [],
  "customItems": [
    {
      "id": "block-1",
      "type": "metric-block",
      "name": "Comfort",
      "size": "2x2",
      "displayMode": "rows",
      "metrics": [
        { "stationId": "{ownedDeviceId}", "metricKey": "outdoor_temp", "labelOverride": null }
      ]
    },
    {
      "id": "div-1",
      "type": "divider",
      "name": "Rainfall",
      "size": "3x1"
    }
  ]
}
```

**Custom item types:** `metric-block` | `divider` | `header-ticker` | `footer-ticker`

**Allowed tile sizes:** `1x1`, `1x2`, `1x3`, `2x1`, `2x2`, `2x3`, `3x1`, `3x2`, `3x3`

---

### `PUT /api/dashboard/layout`

Saves the user's active dashboard layout.

```
PUT /api/dashboard/layout
Authorization: Bearer {jwt}
Content-Type: application/json
```

**Request body** (`DashboardLayoutPayloadDto`):

```json
{
  "layoutMode": "custom",
  "tiles": [],
  "customItems": [ { "id": "block-1", "type": "metric-block", ... } ]
}
```

**Validation rules:**
- Max 20 tiles (Default mode) / max 12 custom items (Custom mode)
- All `customItems[].id` values must be unique within the payload
- `type` must be one of `metric-block | divider | header-ticker | footer-ticker`
- Tile `w` and `h` ≥ 1; size string must match `NxM` pattern
- All `metricKey` values must exist in the shared `MetricRegistry`
- All `stationId` references must be owned by the authenticated user (HTTP 403 if not)
- `displayMode: "fill"` requires exactly one metric in the block

Returns the saved `DashboardLayoutDto` on success (200).

| Status | Condition |
|---|---|
| 200 | Layout saved; returns saved layout |
| 400 | Validation failure (duplicate ids, unknown metric key, invalid size, etc.) |
| 401 | Missing or invalid JWT |
| 403 | `stationId` in a metric block is not owned by the authenticated user |

---

## Settings — preferences (Phase 10 addition)

### `temperatureDecimals` field

The preferences DTO now includes `temperatureDecimals: 0 | 1 | 2` (decimal places to show for all temperature values). Default is `1` (one decimal place). `0` rounds to the nearest degree.

Accepted by `PUT /api/settings/preferences` and returned by `GET /api/settings/preferences`.

---

## SignalR realtime hub (Phase 9+)

### `GET /hubs/weather` (WebSocket upgrade)

Authenticated clients receive `ReadingUpdated` push events whenever the server-side
Socket.IO subscriber receives a new reading from Ambient Weather.

**Connection:** SignalR JSON protocol over WebSocket. Pass the Auth0 access token as the
`access_token` query parameter or via `accessTokenFactory` (recommended for browser clients).

**Authentication:** `[Authorize(Policy = "AuthenticatedUser")]` — unauthenticated negotiate
returns HTTP 401.

**Group isolation:** Each client is added to `user:{sha256(sub)}` on connect. Events are
delivered only to the owning user's group. A connection from user A can never receive user B's
readings.

**Event: `ReadingUpdated`**

Payload is `ReadingUpdatedEventDto` containing the same `CurrentReadingDto` shape as
`GET /api/dashboard/current`.

```json
{
  "reading": {
    "deviceId": "{ownedDeviceId}",
    "deviceName": "{stationName}",
    "timestampUtc": "2026-05-31T12:00:00Z",
    "receivedAtUtc": "2026-05-31T12:00:01Z",
    "tempF": 72.4
  }
}
```

**Frontend hook:** `useWeatherHub` (`src/hooks/useWeatherHub.ts`) wraps the connection
lifecycle. Reconnects with bounded exponential back-off (1 s → 30 s). On `ReadingUpdated`
it calls `queryClient.setQueryData(queryKeys.dashboard.current(), dto.reading)` directly —
no network round-trip needed.

---

## Data timing notes

- Most devices update every minute; some less frequently
- Timestamps are rounded to the nearest minute on the server
- History endpoint returns 5-min or 30-min increment data
- Up to 10-minute delay before recent readings appear in history
- `/devices` `lastData` is always the freshest available reading
