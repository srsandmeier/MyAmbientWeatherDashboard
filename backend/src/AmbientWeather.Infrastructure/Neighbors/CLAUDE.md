# Nearby provider rules

Loaded when Claude works on files in `Infrastructure/Neighbors/`: the public providers behind
`INearbyWeatherProvider` (Domain) and the discovery and aggregation services. Ambient's own REST client is
in `../Ambient/CLAUDE.md`.

---

## Providers

### Providers and their contracts
| Provider | Source | Notes |
|---|---|---|
| `AmbientOpenWeatherProvider` | Ambient's public web-app API at `lightning.ambientweather.net` | Undocumented and experimental; off unless `Features:AmbientOpenApiEnabled=true`; needs no user keys. Only current public data is confirmed, never history |
| `WeatherGovNearbyObservationProvider` | Weather.gov / NWS observations | Requires a User-Agent: `DependencyInjection.cs` adds the one from `UserAgentOptions` to the provider HTTP clients |
| `OpenMeteoNearbyBaselineProvider` | Open-Meteo forecast API (`OpenMeteoUriBuilder`) | Official docs: https://open-meteo.com/en/docs |

- Every provider payload is untrusted: validate its shape before mapping, and degrade to "no neighbour
  data" when the provider changes, blocks or fails; never fail the dashboard.
- `NeighborAggregationService` averages each metric (mean) over the stations that report it; indoor
  metrics are never aggregated from neighbours.
- Neighbour values are labelled as a comparison with their source, never as the user's own reading
  (`domain-ux`).

### Open-Meteo requests
- The neighbour baseline uses `timezone=auto` and no model; a saved public source's current reading passes
  its saved timezone and `models=best_match`. Both URLs are built only in `OpenMeteoUriBuilder`.
- Request only fields the backend maps and the frontend shows or deliberately hides through
  provider-specific metric support. A forecast field is never shown as a current observation without a
  clear label.
- Each newly exposed field gets a backend mapping test and a frontend picker or render test, and the
  phase plan links the official docs.

### Providers: must not
- Call a provider from a handler or the frontend: go through the provider interface.
- Build a provider URL from user input other than validated coordinates.
