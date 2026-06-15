namespace AmbientWeather.Domain.Neighbors;

/// <summary>
/// Discovers nearby public weather stations for the given user configuration.
/// Implementations represent a single data source (Ambient Open API, Weather.gov, Open-Meteo).
/// </summary>
public interface INearbyWeatherProvider
{
    /// <summary>
    /// Stable provider identifier used in <see cref="NeighborStation.Provider"/> and as the
    /// discriminator in <c>neighbor_station_cache.provider</c>.
    /// </summary>
    string ProviderName { get; }

    /// <summary>
    /// Discovers nearby stations for the user's coordinates and configuration.
    /// Returns an empty list rather than throwing when the provider is disabled, the
    /// coordinates are outside the provider's supported area, or no stations are found.
    /// </summary>
    Task<IReadOnlyList<NeighborStation>> DiscoverAsync(
        NeighborConfig config,
        CancellationToken cancellationToken = default);
}
