using System.Collections.Concurrent;

namespace AmbientWeather.Infrastructure.Ambient;

/// <summary>
/// Shared in-process state for Ambient Weather rate-limit buckets.
/// </summary>
public sealed class AmbientRateLimitState
{
    private readonly ConcurrentDictionary<string, RateLimitBucket> _buckets = new(StringComparer.Ordinal);
    private readonly TimeSpan _bucketIdleLifetime;
    private readonly int _cleanupScanInterval;
    private int _waitsSinceCleanup;

    /// <summary>
    /// Initializes a new instance of the <see cref="AmbientRateLimitState"/> class.
    /// </summary>
    public AmbientRateLimitState()
        : this(TimeSpan.FromMinutes(30), 100)
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="AmbientRateLimitState"/> class.
    /// </summary>
    /// <param name="bucketIdleLifetime">How long an unused bucket can remain before cleanup.</param>
    /// <param name="cleanupScanInterval">How many waits occur before scanning for idle buckets.</param>
    public AmbientRateLimitState(TimeSpan bucketIdleLifetime, int cleanupScanInterval)
    {
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(bucketIdleLifetime, TimeSpan.Zero);
        ArgumentOutOfRangeException.ThrowIfLessThan(cleanupScanInterval, 1);

        _bucketIdleLifetime = bucketIdleLifetime;
        _cleanupScanInterval = cleanupScanInterval;
    }

    /// <summary>
    /// Gets the current number of in-process rate-limit buckets.
    /// </summary>
    public int BucketCount => _buckets.Count;

    /// <summary>
    /// Waits until the specified rate-limit bucket can issue another request.
    /// </summary>
    /// <param name="bucketKey">The bucket identifier.</param>
    /// <param name="minimumInterval">The minimum interval between requests in the bucket.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>A task that completes when the request may proceed.</returns>
    public async Task WaitAsync(string bucketKey, TimeSpan minimumInterval, CancellationToken cancellationToken = default)
    {
        CleanupIdleBucketsIfNeeded();
        var bucket = _buckets.GetOrAdd(bucketKey, _ => new RateLimitBucket());

        await bucket.Gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            var now = DateTimeOffset.UtcNow;
            if (bucket.NextAllowedAt > now)
            {
                await Task.Delay(bucket.NextAllowedAt - now, cancellationToken).ConfigureAwait(false);
                now = DateTimeOffset.UtcNow;
            }

            bucket.NextAllowedAt = now + minimumInterval;
            bucket.LastUsedAt = now;
        }
        finally
        {
            bucket.Gate.Release();
        }
    }

    private void CleanupIdleBucketsIfNeeded()
    {
        if (Interlocked.Increment(ref _waitsSinceCleanup) % _cleanupScanInterval != 0)
        {
            return;
        }

        var cutoff = DateTimeOffset.UtcNow - _bucketIdleLifetime;
        foreach (var (key, bucket) in _buckets)
        {
            if (bucket.LastUsedAt < cutoff && bucket.NextAllowedAt <= DateTimeOffset.UtcNow && bucket.Gate.CurrentCount > 0)
            {
                _buckets.TryRemove(key, out _);
            }
        }
    }

    private sealed class RateLimitBucket
    {
        public SemaphoreSlim Gate { get; } = new(1, 1);

        public DateTimeOffset NextAllowedAt { get; set; } = DateTimeOffset.MinValue;

        public DateTimeOffset LastUsedAt { get; set; } = DateTimeOffset.UtcNow;
    }
}
