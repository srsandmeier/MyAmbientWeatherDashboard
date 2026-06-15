using System.Collections.Concurrent;
using AmbientWeather.Application.Common;

namespace AmbientWeather.Infrastructure.Ambient;

/// <summary>
/// Shared in-process circuit-breaker state for Ambient Weather REST calls, partitioned by
/// application-key bucket so that one bad credential does not open the circuit for other users.
/// </summary>
public sealed class AmbientCircuitBreakerState
{
    private readonly ConcurrentDictionary<string, PerKeyState> _states = new(StringComparer.Ordinal);

    private PerKeyState For(string bucketKey) =>
        _states.GetOrAdd(bucketKey, _ => new PerKeyState());

    /// <summary>
    /// Throws <see cref="AmbientCircuitOpenException"/> when the circuit for
    /// <paramref name="bucketKey"/> is currently open.
    /// </summary>
    public void ThrowIfOpen(string bucketKey) => For(bucketKey).ThrowIfOpen();

    /// <summary>
    /// Records a successful request and closes the circuit for <paramref name="bucketKey"/>.
    /// </summary>
    public void RecordSuccess(string bucketKey) => For(bucketKey).RecordSuccess();

    /// <summary>
    /// Records a failed request for <paramref name="bucketKey"/> and opens the circuit when
    /// the consecutive failure threshold is reached.
    /// </summary>
    /// <param name="bucketKey">The application-key bucket identifier.</param>
    /// <param name="failureThreshold">The consecutive failure threshold.</param>
    /// <param name="breakDuration">The length of time to keep the circuit open.</param>
    public void RecordFailure(string bucketKey, int failureThreshold, TimeSpan breakDuration) =>
        For(bucketKey).RecordFailure(failureThreshold, breakDuration);

    private sealed class PerKeyState
    {
        private readonly Lock _gate = new();
        private int _consecutiveFailures;
        private DateTimeOffset _openUntil = DateTimeOffset.MinValue;

        public void ThrowIfOpen()
        {
            lock (_gate)
            {
                if (_openUntil > DateTimeOffset.UtcNow)
                    throw new AmbientCircuitOpenException();
            }
        }

        public void RecordSuccess()
        {
            lock (_gate)
            {
                _consecutiveFailures = 0;
                _openUntil = DateTimeOffset.MinValue;
            }
        }

        public void RecordFailure(int failureThreshold, TimeSpan breakDuration)
        {
            lock (_gate)
            {
                _consecutiveFailures++;
                if (_consecutiveFailures >= failureThreshold)
                    _openUntil = DateTimeOffset.UtcNow + breakDuration;
            }
        }
    }
}
