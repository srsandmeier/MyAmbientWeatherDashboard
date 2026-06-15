namespace AmbientWeather.Application.Interfaces;

/// <summary>
/// Resolves a user-entered place query, such as a ZIP code or "City, State", to coordinates.
/// </summary>
public interface ILocationGeocodingService
{
    /// <summary>
    /// Attempts to resolve <paramref name="query"/> into latitude and longitude coordinates.
    /// </summary>
    /// <param name="query">Free-form location query entered by the user.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Resolved coordinates, or <c>null</c> when no location could be resolved.</returns>
    Task<GeocodedLocation?> GeocodeAsync(string query, CancellationToken cancellationToken = default);
}
