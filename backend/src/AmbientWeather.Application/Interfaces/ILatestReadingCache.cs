using AmbientWeather.Application.DTOs.Realtime;

namespace AmbientWeather.Application.Interfaces;

/// <summary>
/// Short-lived cache for the most recent <see cref="CurrentReadingDto"/> per station.
/// Backed by Redis in production; an in-memory fallback is used when Redis is unavailable.
/// </summary>
public interface ILatestReadingCache
{
    /// <summary>
    /// Returns the cached reading for the given user and station, or <see langword="null"/>
    /// when no entry exists or the entry has expired.
    /// </summary>
    /// <param name="userHash">SHA-256 hex hash of the authenticated user subject.</param>
    /// <param name="normalizedMac">Normalized MAC address of the target station.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task<CurrentReadingDto?> GetAsync(
        string userHash,
        string normalizedMac,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Stores <paramref name="reading"/> under the given user and station key.
    /// The entry expires after a fixed TTL (5 minutes) so callers detect stale/offline states.
    /// </summary>
    /// <param name="userHash">SHA-256 hex hash of the authenticated user subject.</param>
    /// <param name="normalizedMac">Normalized MAC address of the target station.</param>
    /// <param name="reading">The reading to cache.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task SetAsync(
        string userHash,
        string normalizedMac,
        CurrentReadingDto reading,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes any cached entry for the given user and station.
    /// Called when credentials are deleted so stale data cannot be served after logout.
    /// </summary>
    /// <param name="userHash">SHA-256 hex hash of the authenticated user subject.</param>
    /// <param name="normalizedMac">Normalized MAC address of the target station.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task RemoveAsync(
        string userHash,
        string normalizedMac,
        CancellationToken cancellationToken = default);
}
