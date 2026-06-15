using AmbientWeather.Application.Common;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace AmbientWeather.Infrastructure.Services;

/// <summary>
/// <see cref="IRealtimeSubscriptionRegistry"/> backed by the application database.
/// Queries all users who have saved Ambient credentials and at least one synced station.
/// Registered as a singleton; uses <see cref="IServiceScopeFactory"/> to create short-lived
/// DbContext scopes for each query.
/// </summary>
public sealed partial class DatabaseRealtimeSubscriptionRegistry(
    IServiceScopeFactory scopeFactory,
    ILogger<DatabaseRealtimeSubscriptionRegistry> logger) : IRealtimeSubscriptionRegistry
{
    /// <inheritdoc />
    public event EventHandler? SubscriptionsChanged;

    /// <inheritdoc />
    public async Task<IReadOnlyList<SubscriptionTarget>> GetActiveSubscriptionsAsync(
        CancellationToken cancellationToken = default)
    {
        using var scope = scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AmbientWeatherDbContext>();

        // Project only the four string fields needed — avoids materialising AmbientCredentials
        // (encrypted key blobs) into memory. UserSegmentHash.Compute cannot be translated to SQL
        // so it is applied in-memory after the lightweight projection is fetched.
        var rawTargets = await dbContext.Users
            .AsNoTracking()
            .Where(u => u.AmbientCredentials != null && u.WeatherStations.Any())
            .SelectMany(u => u.WeatherStations.Select(s => new
            {
                u.AuthProviderSubject,
                s.MacAddress,
                StationName = (string?)(s.Nickname ?? s.Name),
            }))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var targets = rawTargets
            .Select(r => new SubscriptionTarget(
                Subject: r.AuthProviderSubject,
                UserHash: UserSegmentHash.Compute(r.AuthProviderSubject),
                MacAddress: r.MacAddress,
                StationName: r.StationName))
            .ToList();

        LogSubscriptionsLoaded(logger, targets.Count);
        return targets;
    }

    /// <inheritdoc />
    public Task InvalidateAsync(string subject, CancellationToken cancellationToken = default)
    {
        var hash = UserSegmentHash.Compute(subject);
        LogSubscriptionInvalidated(logger, hash.Length > 8 ? hash[..8] : hash);
        SubscriptionsChanged?.Invoke(this, EventArgs.Empty);
        return Task.CompletedTask;
    }

    [LoggerMessage(Level = LogLevel.Debug,
        Message = "Subscription registry: loaded {Count} active subscription target(s).")]
    private static partial void LogSubscriptionsLoaded(ILogger logger, int count);

    [LoggerMessage(Level = LogLevel.Information,
        Message = "Subscription registry: invalidated for user hash prefix {HashPrefix}…")]
    private static partial void LogSubscriptionInvalidated(ILogger logger, string hashPrefix);
}
