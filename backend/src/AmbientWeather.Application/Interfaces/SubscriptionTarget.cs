namespace AmbientWeather.Application.Interfaces;

/// <summary>
/// Describes a single station that requires an active Ambient realtime subscription.
/// </summary>
/// <param name="Subject">Auth0 subject of the owning user; used by Infrastructure to resolve credentials.</param>
/// <param name="UserHash">SHA-256 hex hash of <paramref name="Subject"/>; used for Redis channel and cache keys.</param>
/// <param name="MacAddress">Normalized MAC address of the station.</param>
/// <param name="StationName">Display name carried into published readings.</param>
public record SubscriptionTarget(
    string Subject,
    string UserHash,
    string MacAddress,
    string? StationName);
