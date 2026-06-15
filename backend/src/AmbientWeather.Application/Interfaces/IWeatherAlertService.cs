using AmbientWeather.Application.DTOs.Alerts;

namespace AmbientWeather.Application.Interfaces;

/// <summary>
/// Fetches active public weather alerts for a user-scoped location.
/// </summary>
public interface IWeatherAlertService
{
    /// <summary>
    /// Returns active weather alerts near the specified coordinates.
    /// </summary>
    /// <param name="userHash">Hashed authenticated-user segment for cache isolation.</param>
    /// <param name="latitude">Latitude in decimal degrees.</param>
    /// <param name="longitude">Longitude in decimal degrees.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task<IReadOnlyList<WeatherAlertDto>> GetActiveAlertsAsync(
        string userHash,
        double latitude,
        double longitude,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns active weather alerts for a Weather.gov area, zone, or state code.
    /// </summary>
    /// <param name="userHash">Hashed authenticated-user segment for cache isolation.</param>
    /// <param name="areaCode">Weather.gov area, zone, or state code.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task<IReadOnlyList<WeatherAlertDto>> GetActiveAlertsForAreaAsync(
        string userHash,
        string areaCode,
        CancellationToken cancellationToken = default);
}
