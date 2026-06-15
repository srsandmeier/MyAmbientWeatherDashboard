# Ambient History API Research

This note records the Ambient Weather history endpoint behavior that drives the v1 history strategy in
`docs/DEVELOPMENT_PLAN.md`.

## Endpoint

Ambient Weather REST history endpoint:

```text
GET https://api.ambientweather.net/v1/devices/{macAddress}
```

Query parameters:

| Parameter | Required | Notes |
|---|---:|---|
| `apiKey` | Yes | User Ambient API key. Keep server-side only. |
| `applicationKey` | Yes | Ambient application key. Keep server-side only. |
| `limit` | No | Maximum number of readings to return. Ambient documents a max of `288`. |
| `endDate` | No | Return readings at or before this date/time; omit for most recent readings. |

## Behavior Relevant To This App

- The endpoint returns historical device readings for one MAC address.
- Results page backward from `endDate`; omitting `endDate` returns the most recent readings.
- `limit=288` is enough for roughly one day at 5-minute resolution.
- Some devices/reporting modes use 30-minute intervals, so one page can cover more than one day.
- Recent history can lag realtime/current data by several minutes.
- Rate limits still apply:
  - 1 request/second per user API key.
  - 3 requests/second per application key.

## Product Implication

For v1, the app does not need mandatory local raw weather time-series storage. Historical chart data can be
served by:

1. Fetching Ambient history pages through the backend only.
2. Paging backward with `endDate` and `limit=288`.
3. Trimming merged results to the requested preset, custom range, or specific historical date.
4. Caching Ambient pages and assembled chart results in Redis / `IDistributedCache`.

Local PostgreSQL tables for `weather_readings`, `reading_aggregates`, and `history_sync_cursors` should
remain optional future optimizations unless Ambient API + Redis cache proves too slow, too costly in API
budget, or insufficient for offline/long-range aggregation needs.

## Specific Historical Date Mode

For a query like:

```text
GET /api/metrics/{metricKey}/history?range=date&date=YYYY-MM-DD&deviceId=...
```

Backend behavior should be:

1. Resolve the date in the user's configured timezone or station timezone.
2. Calculate start-of-day and end-of-day boundaries.
3. Fetch Ambient history page(s) backward from end-of-day.
4. Stop once fetched data is older than start-of-day.
5. Trim results to the exact calendar day.
6. Cache by user, device, date, metric, source, and granularity.

## Approximate Call Budget

| User action | Approximate Ambient calls when uncached | Notes |
|---|---:|---|
| One historical date | 1 | Usually one `limit=288` page at 5-minute resolution. |
| Last 7 days | 7 | One page per day at 5-minute resolution. |
| Last 30 days | 30 | Should show progress/loading if uncached. |
| Last 90 days | 90 | Consider async fetch/progress UX. |
| Last 1 year | 365 | Feasible at 1 req/sec but slow; cache aggressively or export asynchronously. |

## References

- Ambient Weather REST API docs: https://ambientweather.docs.apiary.io/
- Official API blueprint: https://raw.githubusercontent.com/ambient-weather/api-docs/master/apiary.apib
- Device data specs: https://github.com/ambient-weather/api-docs/wiki/Device-Data-Specs
