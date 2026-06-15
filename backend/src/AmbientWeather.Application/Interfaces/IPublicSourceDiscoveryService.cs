using AmbientWeather.Application.DTOs.PublicSources;

namespace AmbientWeather.Application.Interfaces;

/// <summary>
/// Geocodes a location query and returns matching public weather sources.
/// </summary>
public interface IPublicSourceDiscoveryService
{
    /// <summary>
    /// Searches for public weather sources near the given location query.
    /// </summary>
    /// <param name="searchQuery">Zipcode or "City, State" string.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Up to 5 NWS observation stations plus one Open-Meteo entry, or an empty list on failure.</returns>
    Task<IReadOnlyList<DiscoveredPublicSourceDto>> DiscoverAsync(string searchQuery, CancellationToken cancellationToken = default);
}
