namespace AmbientWeather.Application.Interfaces;

/// <summary>
/// Provides the set of stations that currently need active Ambient Socket.IO subscriptions.
/// The backend realtime subscriber queries this registry on startup and after any credential
/// or station change to determine which API keys and MAC addresses to monitor.
/// </summary>
public interface IRealtimeSubscriptionRegistry
{
    /// <summary>
    /// Raised after <see cref="InvalidateAsync"/> marks the subscription set as dirty.
    /// <see cref="RealtimeSubscriberService"/> subscribes to this event and tears down its
    /// current connections to reinitialize with fresh subscriptions.
    /// </summary>
    event EventHandler? SubscriptionsChanged;

    /// <summary>
    /// Returns all (user, station) pairs for which an active Ambient realtime subscription
    /// should be maintained. Only users with saved credentials and at least one synced station
    /// are included.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task<IReadOnlyList<SubscriptionTarget>> GetActiveSubscriptionsAsync(
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Signals that the subscription set may have changed for <paramref name="subject"/>
    /// (e.g., credentials were saved or deleted, or stations were re-synced).
    /// Implementations raise <see cref="SubscriptionsChanged"/> after invalidating cached state.
    /// </summary>
    /// <param name="subject">Auth0 subject of the user whose subscriptions may have changed.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task InvalidateAsync(string subject, CancellationToken cancellationToken = default);
}
