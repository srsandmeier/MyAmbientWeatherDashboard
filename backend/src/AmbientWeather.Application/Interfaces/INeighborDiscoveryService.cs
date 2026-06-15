using AmbientWeather.Domain.Neighbors;

namespace AmbientWeather.Application.Interfaces;

/// <summary>
/// Discovers, caches, and persists nearby public weather stations for a user.
/// </summary>
public interface INeighborDiscoveryService
{
    /// <summary>
    /// Returns the cached neighbor station list for the user, re-discovering if the cache
    /// has expired or is absent.
    /// </summary>
    /// <param name="userHash">The user's segment hash (used as Redis and DB key).</param>
    /// <param name="config">Neighbor configuration with runtime coordinates populated.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task<IReadOnlyList<NeighborStation>> GetOrDiscoverAsync(
        string userHash,
        NeighborConfig config,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes the cached neighbor station list for the user, forcing a full re-discovery on
    /// the next <see cref="GetOrDiscoverAsync"/> call.
    /// </summary>
    Task InvalidateCacheAsync(string userHash, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns the most recently cached reading for a single pinned station, or
    /// <see langword="null"/> if the station has not been discovered yet.
    /// </summary>
    /// <param name="userHash">The user's segment hash.</param>
    /// <param name="provider">Provider name (e.g. <c>WeatherGov</c>).</param>
    /// <param name="sourceId">Provider-assigned station identifier.</param>
    Task<NeighborStation?> GetCachedStationAsync(
        string userHash,
        string provider,
        string sourceId,
        CancellationToken cancellationToken = default);
}
