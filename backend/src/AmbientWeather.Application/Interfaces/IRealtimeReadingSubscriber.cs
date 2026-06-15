namespace AmbientWeather.Application.Interfaces;

/// <summary>
/// Subscribes to the Redis pub/sub channel for a specific user and fans out incoming
/// <c>ReadingUpdated</c> events to that user's connected SignalR clients.
/// One subscription is maintained per user hash for as long as that user has an active
/// SignalR connection.
/// </summary>
public interface IRealtimeReadingSubscriber : IAsyncDisposable
{
    /// <summary>
    /// Starts forwarding Redis pub/sub messages for <paramref name="userHash"/> to
    /// the matching SignalR user group. Has no effect if a subscription already exists.
    /// </summary>
    /// <param name="userHash">SHA-256 hex hash of the authenticated user subject.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task SubscribeAsync(string userHash, CancellationToken cancellationToken = default);

    /// <summary>
    /// Stops forwarding Redis pub/sub messages for <paramref name="userHash"/>.
    /// Called when the last SignalR connection for that user disconnects.
    /// </summary>
    /// <param name="userHash">SHA-256 hex hash of the authenticated user subject.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task UnsubscribeAsync(string userHash, CancellationToken cancellationToken = default);
}
