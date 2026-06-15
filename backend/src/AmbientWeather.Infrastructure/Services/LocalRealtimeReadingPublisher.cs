using AmbientWeather.Application.DTOs.Realtime;
using AmbientWeather.Application.Interfaces;

namespace AmbientWeather.Infrastructure.Services;

/// <summary>
/// <see cref="IRealtimeReadingPublisher"/> for Development and Testing environments where
/// Redis pub/sub is not available. Updates the latest-reading cache so the
/// <c>GET /api/dashboard/current</c> REST fallback still works locally, but does not
/// publish to any pub/sub channel.
/// </summary>
public sealed class LocalRealtimeReadingPublisher(
    ILatestReadingCache latestReadingCache) : IRealtimeReadingPublisher
{
    /// <inheritdoc />
    public Task PublishAsync(
        string userHash,
        CurrentReadingDto reading,
        CancellationToken cancellationToken = default) =>
        latestReadingCache.SetAsync(userHash, reading.DeviceId, reading, cancellationToken);
}
