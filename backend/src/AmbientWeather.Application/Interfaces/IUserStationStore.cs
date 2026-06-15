using AmbientWeather.Application.DTOs.AmbientApi;
using AmbientWeather.Domain.Entities;

namespace AmbientWeather.Application.Interfaces;

/// <summary>
/// Retrieves and persists <see cref="WeatherStation"/> records for authenticated users.
/// </summary>
public interface IUserStationStore
{
    /// <summary>
    /// Returns all weather stations owned by the given user.
    /// </summary>
    /// <param name="authProviderSubject">The authenticated provider subject claim.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>The user's owned stations; empty when none have been synced yet.</returns>
    Task<IReadOnlyList<WeatherStation>> GetOwnedStationsAsync(
        string authProviderSubject,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns a single owned station by MAC address, or <see langword="null"/> when not found.
    /// </summary>
    /// <param name="authProviderSubject">The authenticated provider subject claim.</param>
    /// <param name="macAddress">The normalized or raw MAC address.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    Task<WeatherStation?> GetOwnedStationByMacAsync(
        string authProviderSubject,
        string macAddress,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Upserts <see cref="WeatherStation"/> rows from the Ambient <c>GET /devices</c> response.
    /// Provider metadata (name, coordinates, elevation, last-sync timestamp) is refreshed on each
    /// sync. User-managed fields (nickname, display, primary, selected metrics) are preserved.
    /// The first device is marked primary when no primary row yet exists for the user.
    /// </summary>
    /// <param name="authProviderSubject">The authenticated provider subject claim.</param>
    /// <param name="email">The user's email address when available.</param>
    /// <param name="devices">Device list returned by <see cref="IAmbientRestClient.GetDevicesAsync"/>.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>The synced stations after upsert.</returns>
    Task<IReadOnlyList<WeatherStation>> SyncStationsAsync(
        string authProviderSubject,
        string? email,
        IReadOnlyList<DeviceDto> devices,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Persists changes to the provided station entity.
    /// When <see cref="WeatherStation.IsPrimary"/> is set to <see langword="true"/>, clears the
    /// flag on all other stations owned by the same user within the same save.
    /// </summary>
    /// <param name="station">The station entity with updated values.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    Task SaveAsync(WeatherStation station, CancellationToken cancellationToken = default);

    /// <summary>
    /// Resolves the user's default owned station.
    /// Uses <see cref="UserPreferences.DefaultWeatherStationId"/> when set and valid; falls back to the
    /// primary station and repairs the default pointer when needed.
    /// </summary>
    /// <param name="authProviderSubject">The authenticated provider subject claim.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>
    /// The default or primary station, or <see langword="null"/> when the user has no owned stations.
    /// </returns>
    Task<WeatherStation?> GetDefaultStationAsync(
        string authProviderSubject,
        CancellationToken cancellationToken = default);
}
