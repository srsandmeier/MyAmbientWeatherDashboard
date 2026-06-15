using AmbientWeather.Application.DTOs.Metrics;

namespace AmbientWeather.Application.Interfaces;

/// <summary>
/// Fetches, pages, caches, and aggregates Ambient Weather device history into a chart-ready series.
/// </summary>
public interface IAmbientHistoryService
{
    /// <summary>
    /// Returns a chart-ready metric history series for the requested time window.
    /// Pages backward through Ambient history, caching individual pages in the distributed cache,
    /// then trims and aggregates to the requested granularity.
    /// </summary>
    /// <param name="macAddress">Normalized MAC address of the target station.</param>
    /// <param name="deviceName">Display name carried into the response DTO.</param>
    /// <param name="metricKey">User-facing metric key (e.g., <c>outdoor_temp</c>).</param>
    /// <param name="fromUtc">Inclusive UTC start of the requested window.</param>
    /// <param name="toUtc">Inclusive UTC end of the requested window.</param>
    /// <param name="granularity">Resolved granularity: <c>raw</c>, <c>hour</c>, or <c>day</c>.</param>
    /// <param name="range">Original range string carried into the response DTO.</param>
    /// <param name="subject">Authenticated user subject; used for credential resolution and cache key isolation.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task<MetricHistoryResponseDto> GetHistoryAsync(
        string macAddress,
        string? deviceName,
        string metricKey,
        DateTime fromUtc,
        DateTime toUtc,
        string granularity,
        string range,
        string subject,
        CancellationToken cancellationToken = default);
}
