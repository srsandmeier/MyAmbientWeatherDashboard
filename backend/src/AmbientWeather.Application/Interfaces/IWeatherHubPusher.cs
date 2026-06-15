using AmbientWeather.Application.DTOs.Realtime;

namespace AmbientWeather.Application.Interfaces;

/// <summary>
/// Pushes a <see cref="ReadingUpdatedEventDto"/> to all SignalR clients that belong to a
/// specific user's group. Implemented in the API layer (<c>WeatherHubPusher</c>) so the
/// Infrastructure subscriber can deliver messages without a direct dependency on SignalR or
/// on the concrete hub type.
/// </summary>
public interface IWeatherHubPusher
{
    /// <summary>
    /// Sends a <c>ReadingUpdated</c> SignalR event to every connection in the group
    /// <c>user:{userHash}</c>.
    /// </summary>
    /// <param name="userHash">SHA-256 hex hash of the target user's Auth0 subject.</param>
    /// <param name="dto">The reading event payload.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task SendReadingUpdatedAsync(
        string userHash,
        ReadingUpdatedEventDto dto,
        CancellationToken cancellationToken = default);
}
