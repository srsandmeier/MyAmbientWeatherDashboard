using System.ComponentModel.DataAnnotations;

namespace AmbientWeather.Infrastructure.Ambient;

/// <summary>
/// Per-key rate-limiting intervals enforced by <see cref="RateLimitedApiClient"/>.
/// </summary>
public sealed class AmbientRateLimitsOptions
{
    /// <summary>Minimum time between requests for the same user API key, in milliseconds.</summary>
    [Range(0, 60_000)]
    public int UserApiKeyIntervalMilliseconds { get; set; } = 1000;

    /// <summary>
    /// Minimum time between requests for the same application key, in milliseconds
    /// (1000 ms / 3 req/s ≈ 334 ms).
    /// </summary>
    [Range(0, 60_000)]
    public int ApplicationKeyIntervalMilliseconds { get; set; } = 334;
}
