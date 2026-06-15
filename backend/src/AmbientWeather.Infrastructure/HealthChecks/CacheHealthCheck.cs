using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace AmbientWeather.Infrastructure.HealthChecks;

/// <summary>
/// Health check for the distributed cache. Reports the active cache mode (Redis or in-memory)
/// and verifies Redis connectivity when Redis is configured.
/// </summary>
public sealed class CacheHealthCheck : IHealthCheck
{
    private readonly IDistributedCache _cache;

    /// <summary>Initializes a new instance of <see cref="CacheHealthCheck"/>.</summary>
    public CacheHealthCheck(IDistributedCache cache) => _cache = cache;

    /// <inheritdoc/>
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        if (_cache is MemoryDistributedCache)
        {
            return HealthCheckResult.Healthy("In-memory cache (non-distributed; Redis not configured).");
        }

        try
        {
            const string probeKey = "__health_probe__";
            await _cache.SetStringAsync(
                probeKey,
                "1",
                new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(5),
                },
                cancellationToken).ConfigureAwait(false);
            await _cache.RemoveAsync(probeKey, cancellationToken).ConfigureAwait(false);
            return HealthCheckResult.Healthy("Redis.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Redis unreachable.", ex);
        }
    }
}
