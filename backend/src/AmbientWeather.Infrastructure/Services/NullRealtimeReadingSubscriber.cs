using AmbientWeather.Application.Interfaces;

namespace AmbientWeather.Infrastructure.Services;

/// <summary>
/// No-op <see cref="IRealtimeReadingSubscriber"/> for Development and Testing environments
/// where Redis is not available. Hub connections succeed but no Redis pub/sub fan-out occurs.
/// </summary>
public sealed class NullRealtimeReadingSubscriber : IRealtimeReadingSubscriber
{
    /// <inheritdoc />
    public Task SubscribeAsync(string userHash, CancellationToken cancellationToken = default) =>
        Task.CompletedTask;

    /// <inheritdoc />
    public Task UnsubscribeAsync(string userHash, CancellationToken cancellationToken = default) =>
        Task.CompletedTask;

    /// <inheritdoc />
    public ValueTask DisposeAsync() => ValueTask.CompletedTask;
}
