namespace AmbientWeather.Application.Interfaces;

/// <summary>
/// Coordinates resolved from a user-entered location query.
/// </summary>
/// <param name="Latitude">Latitude in decimal degrees.</param>
/// <param name="Longitude">Longitude in decimal degrees.</param>
/// <param name="DisplayName">Human-readable location label returned by the geocoder.</param>
public sealed record GeocodedLocation(double Latitude, double Longitude, string? DisplayName);
