using AmbientWeather.Application.Interfaces;

namespace AmbientWeather.Infrastructure.Services;

/// <summary>
/// No-op <see cref="IRealtimeSubscriptionRegistry"/> registered as a fallback in
/// Development and Testing environments where no database is configured. Returns an
/// empty subscription list so <see cref="RealtimeSubscriberService"/> starts cleanly
/// without attempting to open any Ambient Socket.IO connections.
/// </summary>
public sealed class NullRealtimeSubscriptionRegistry : IRealtimeSubscriptionRegistry
{
#pragma warning disable CS0067 // event is never raised — intentional for no-op
    /// <inheritdoc />
    public event EventHandler? SubscriptionsChanged;
#pragma warning restore CS0067

    /// <inheritdoc />
    public Task<IReadOnlyList<SubscriptionTarget>> GetActiveSubscriptionsAsync(
        CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<SubscriptionTarget>>([]);

    /// <inheritdoc />
    public Task InvalidateAsync(string subject, CancellationToken cancellationToken = default) =>
        Task.CompletedTask;
}
