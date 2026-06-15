using AmbientWeather.Application.DTOs.Realtime;

namespace AmbientWeather.Application.Interfaces;

/// <summary>
/// Publishes a sanitized current reading to the Redis pub/sub channel for the owning user
/// and simultaneously updates the latest-reading cache entry.
/// Implementations must not log or include Ambient API keys in any published payload.
/// </summary>
public interface IRealtimeReadingPublisher
{
    /// <summary>
    /// Publishes <paramref name="reading"/> to the Redis channel
    /// <c>ambient:readings:{userHash}</c> and writes it to the latest-reading cache.
    /// </summary>
    /// <param name="userHash">SHA-256 hex hash of the authenticated user subject.</param>
    /// <param name="reading">The sanitized current reading to publish.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task PublishAsync(
        string userHash,
        CurrentReadingDto reading,
        CancellationToken cancellationToken = default);
}
