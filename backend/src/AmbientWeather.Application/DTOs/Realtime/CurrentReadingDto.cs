namespace AmbientWeather.Application.DTOs.Realtime;

/// <summary>
/// A sanitized, station-annotated snapshot of the most recent weather reading.
/// Used as the canonical current-reading shape for the Redis latest-reading cache,
/// Redis pub/sub messages, and the SignalR <c>ReadingUpdated</c> event payload.
/// Intentionally includes all sensor fields from the Phase 8 Ambient reading DTOs
/// so Phase 10 dashboard tiles can consume values directly without an additional
/// mapping pass.
/// </summary>
public record CurrentReadingDto
{
    // -------------------------------------------------------------------------
    // Station identity and freshness metadata
    // -------------------------------------------------------------------------

    /// <summary>Gets the normalized MAC address of the station that produced this reading.</summary>
    public required string DeviceId { get; init; }

    /// <summary>Gets the user-assigned nickname, or the provider name when no nickname is set.</summary>
    public string? DeviceName { get; init; }

    /// <summary>Gets the reading timestamp from the Ambient <c>dateutc</c> field.</summary>
    public DateTime TimestampUtc { get; init; }

    /// <summary>
    /// Gets the UTC instant at which the backend service received and processed this reading.
    /// Used by the UI to distinguish a stale cached value from a live update.
    /// </summary>
    public DateTime ReceivedAtUtc { get; init; }

    // -------------------------------------------------------------------------
    // Temperature
    // -------------------------------------------------------------------------

    /// <summary>Gets the outdoor temperature in °F.</summary>
    public double? TempF { get; init; }

    /// <summary>Gets the outdoor sensor battery status. 1 = OK, 0 = Low/Critical.</summary>
    public int? BattOut { get; init; }

    /// <summary>Gets the indoor temperature in °F.</summary>
    public double? TempInF { get; init; }

    /// <summary>Gets the outdoor apparent temperature (heat index or wind chill) in °F.</summary>
    public double? FeelsLike { get; init; }

    /// <summary>Gets the indoor apparent temperature in °F.</summary>
    public double? FeelsLikeIn { get; init; }

    /// <summary>Gets the outdoor dew point in °F.</summary>
    public double? DewPoint { get; init; }

    /// <summary>Gets the indoor dew point in °F.</summary>
    public double? DewPointIn { get; init; }

    // -------------------------------------------------------------------------
    // Humidity
    // -------------------------------------------------------------------------

    /// <summary>Gets the outdoor relative humidity percentage (0–100).</summary>
    public int? Humidity { get; init; }

    /// <summary>Gets the indoor relative humidity percentage (0–100).</summary>
    public int? HumidityIn { get; init; }

    // -------------------------------------------------------------------------
    // Pressure
    // -------------------------------------------------------------------------

    /// <summary>Gets the relative (sea-level) barometric pressure in inHg.</summary>
    public double? BaromRelIn { get; init; }

    /// <summary>Gets the absolute (station) barometric pressure in inHg.</summary>
    public double? BaromAbsIn { get; init; }

    // -------------------------------------------------------------------------
    // Wind
    // -------------------------------------------------------------------------

    /// <summary>Gets the instantaneous wind direction in degrees (0–360).</summary>
    public int? WindDir { get; init; }

    /// <summary>Gets the instantaneous wind speed in mph.</summary>
    public double? WindSpeedMph { get; init; }

    /// <summary>Gets the wind gust speed in mph.</summary>
    public double? WindGustMph { get; init; }

    /// <summary>Gets the maximum daily wind gust in mph.</summary>
    public double? MaxDailyGust { get; init; }

    // -------------------------------------------------------------------------
    // Rainfall
    // -------------------------------------------------------------------------

    /// <summary>Gets the hourly rainfall rate in inches.</summary>
    public double? HourlyRainIn { get; init; }

    /// <summary>Gets the per-event rainfall accumulation in inches.</summary>
    public double? EventRainIn { get; init; }

    /// <summary>Gets the daily rainfall accumulation in inches.</summary>
    public double? DailyRainIn { get; init; }

    /// <summary>Gets the weekly rainfall accumulation in inches.</summary>
    public double? WeeklyRainIn { get; init; }

    /// <summary>Gets the monthly rainfall accumulation in inches.</summary>
    public double? MonthlyRainIn { get; init; }

    /// <summary>Gets the yearly rainfall accumulation in inches.</summary>
    public double? YearlyRainIn { get; init; }

    /// <summary>Gets the total rainfall since factory reset in inches.</summary>
    public double? TotalRainIn { get; init; }

    /// <summary>Gets the UTC timestamp of the last recorded rain event.</summary>
    public DateTime? LastRain { get; init; }

    // -------------------------------------------------------------------------
    // Solar / UV
    // -------------------------------------------------------------------------

    /// <summary>Gets the solar radiation in W/m².</summary>
    public double? SolarRadiation { get; init; }

    /// <summary>Gets the UV index (0–11+).</summary>
    public int? Uv { get; init; }

    // -------------------------------------------------------------------------
    // NWS text fields (WeatherGov sources only; null for all other sources)
    // -------------------------------------------------------------------------

    /// <summary>Gets formatted cloud layer summary, e.g. "FEW @ 1,800ft, OVC @ 5,000ft".</summary>
    public string? NwsSkyConditions { get; init; }

    /// <summary>Gets formatted present weather phenomena, e.g. "Light Rain, Mist".</summary>
    public string? NwsPresentWeather { get; init; }

    /// <summary>Gets the NWS plain-text observation summary.</summary>
    public string? NwsTextDescription { get; init; }

    /// <summary>Gets the raw METAR string.</summary>
    public string? NwsRawMetar { get; init; }

    /// <summary>
    /// Gets the 24-hour high temperature in °F.
    /// Populated for pinned and aggregated neighbor stations; null for owned stations
    /// (which use the dedicated <c>daily-extremes</c> endpoint instead).
    /// </summary>
    public double? DailyHighTempF { get; init; }

    /// <summary>
    /// Gets the 24-hour low temperature in °F.
    /// Populated for pinned and aggregated neighbor stations; null for owned stations.
    /// </summary>
    public double? DailyLowTempF { get; init; }

    // -------------------------------------------------------------------------
    // Open-Meteo extended fields (OpenMeteo sources only; null for all other sources)
    // -------------------------------------------------------------------------

    /// <summary>Gets the cloud cover percentage (0–100).</summary>
    public int? OmCloudCover { get; init; }

    /// <summary>Gets the precipitation probability for the current hour (0–100 %).</summary>
    public int? OmPrecipProbability { get; init; }

    /// <summary>Gets the human-readable WMO weather description, e.g. "Partly cloudy".</summary>
    public string? OmWeatherDescription { get; init; }

    /// <summary>Gets the sunrise local time string, e.g. "6:42 AM".</summary>
    public string? OmSunrise { get; init; }

    /// <summary>Gets the sunset local time string, e.g. "8:15 PM".</summary>
    public string? OmSunset { get; init; }

    /// <summary>Gets the daily UV index maximum.</summary>
    public int? OmUvIndexMax { get; init; }

    /// <summary>Gets the daily precipitation sum in inches.</summary>
    public double? OmPrecipSumIn { get; init; }

    /// <summary>Gets the daily maximum wind speed in mph.</summary>
    public double? OmWindSpeedMax { get; init; }

    /// <summary>Gets the daily maximum wind gust in mph.</summary>
    public double? OmWindGustMax { get; init; }

    /// <summary>Gets the daily dominant wind direction in degrees.</summary>
    public int? OmWindDirDominant { get; init; }

    // -------------------------------------------------------------------------
    // Locale
    // -------------------------------------------------------------------------

    /// <summary>Gets the IANA timezone identifier reported by the station (e.g., <c>America/Chicago</c>).</summary>
    public string? Tz { get; init; }

    // -------------------------------------------------------------------------
    // Provenance
    // -------------------------------------------------------------------------

    /// <summary>
    /// Gets the data source: <c>own</c> for the user's own station,
    /// <c>neighbors</c> for an aggregated reading across nearby public stations.
    /// Defaults to <c>own</c> for backward compatibility with cached entries that pre-date
    /// this field.
    /// </summary>
    public string Source { get; init; } = "own";
}
