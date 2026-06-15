using System.ComponentModel.DataAnnotations;

namespace AmbientWeather.Infrastructure.Ambient;

/// <summary>
/// Resilience policy settings for the Ambient Weather API client.
/// </summary>
public sealed class AmbientResilienceOptions
{
    /// <summary>Maximum number of retries after an initial transient failure (0 = no retries).</summary>
    [Range(0, 10)]
    public int MaxRetryAttempts { get; set; } = 3;

    /// <summary>Base exponential-backoff delay in milliseconds.</summary>
    [Range(0, 30_000)]
    public int BaseRetryDelayMilliseconds { get; set; } = 500;

    /// <summary>Number of consecutive failures before the circuit breaker opens.</summary>
    [Range(1, 100)]
    public int CircuitBreakerFailureThreshold { get; set; } = 5;

    /// <summary>How long the circuit breaker stays open before allowing a probe, in seconds.</summary>
    [Range(1, 600)]
    public int CircuitBreakerBreakDurationSeconds { get; set; } = 30;
}
