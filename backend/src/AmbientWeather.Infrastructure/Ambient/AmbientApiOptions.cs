using System.ComponentModel.DataAnnotations;

namespace AmbientWeather.Infrastructure.Ambient;

/// <summary>
/// Strongly-typed configuration for the Ambient Weather REST API client, rate limiter, and circuit breaker.
/// Bound from the <c>AmbientApi</c> configuration section.
/// </summary>
public sealed class AmbientApiOptions
{
    /// <summary>The configuration section name.</summary>
    public const string SectionName = "AmbientApi";

    /// <summary>Base URL for the Ambient Weather REST API.</summary>
    [Required]
    [Url]
    public string BaseUrl { get; set; } = "https://api.ambientweather.net/v1/";

    /// <summary>Resilience policy settings (retry, circuit breaker).</summary>
    public AmbientResilienceOptions Resilience { get; set; } = new();

    /// <summary>Per-key rate-limiting intervals.</summary>
    public AmbientRateLimitsOptions RateLimits { get; set; } = new();
}
