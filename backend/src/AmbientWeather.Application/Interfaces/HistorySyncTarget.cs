namespace AmbientWeather.Application.Interfaces;

/// <summary>
/// A station and credential pair that should be synchronized from Ambient Weather history.
/// </summary>
/// <param name="UserId">The owning application user identifier.</param>
/// <param name="StationId">The weather station identifier.</param>
/// <param name="MacAddress">The weather station MAC address.</param>
/// <param name="ApiKey">The decrypted Ambient Weather user API key.</param>
/// <param name="ApplicationKey">The decrypted Ambient Weather application key.</param>
public sealed record HistorySyncTarget(
    Guid UserId,
    Guid StationId,
    string MacAddress,
    string ApiKey,
    string ApplicationKey);
