using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using AmbientWeather.Application.Common;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AmbientWeather.Infrastructure.Ambient;

/// <summary>
/// Executes Ambient Weather REST calls with local rate limiting and transient-fault resilience.
/// </summary>
public sealed partial class RateLimitedApiClient(
    IHttpClientFactory httpClientFactory,
    IOptions<AmbientApiOptions> options,
    AmbientRateLimitState rateLimitState,
    AmbientCircuitBreakerState circuitBreakerState,
    ILogger<RateLimitedApiClient> logger)
{
    private const string AmbientHttpClientName = "AmbientWeatherRest";
    private readonly AmbientApiOptions _options = options.Value;
    private int MaxRetryAttempts => _options.Resilience.MaxRetryAttempts;
    private TimeSpan BaseRetryDelay => TimeSpan.FromMilliseconds(_options.Resilience.BaseRetryDelayMilliseconds);
    private int CircuitBreakerFailureThreshold => _options.Resilience.CircuitBreakerFailureThreshold;
    private TimeSpan CircuitBreakerBreakDuration => TimeSpan.FromSeconds(_options.Resilience.CircuitBreakerBreakDurationSeconds);
    private TimeSpan UserApiKeyInterval => TimeSpan.FromMilliseconds(_options.RateLimits.UserApiKeyIntervalMilliseconds);
    private TimeSpan ApplicationKeyInterval => TimeSpan.FromMilliseconds(_options.RateLimits.ApplicationKeyIntervalMilliseconds);

    /// <summary>
    /// Sends a GET request and deserializes the JSON response.
    /// </summary>
    /// <typeparam name="T">The expected response type.</typeparam>
    /// <param name="requestUri">The relative Ambient Weather API request URI.</param>
    /// <param name="apiKey">The Ambient user API key used for per-user throttling.</param>
    /// <param name="applicationKey">The Ambient application key used for application-wide throttling.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>The deserialized response.</returns>
    /// <exception cref="AmbientApiAuthException">Thrown on HTTP 401 or 403 — credentials are invalid.</exception>
    /// <exception cref="AmbientApiNotFoundException">Thrown on HTTP 404 — resource does not exist.</exception>
    /// <exception cref="AmbientApiRateLimitException">Thrown on HTTP 429 after all retries are exhausted.</exception>
    /// <exception cref="AmbientCircuitOpenException">Thrown when the circuit breaker is open.</exception>
    public async Task<T> GetFromJsonAsync<T>(
        string requestUri,
        string? apiKey,
        string? applicationKey,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(requestUri);

        var appKeyBucket = GetApplicationKeyBucket(applicationKey);
        for (var attempt = 1; attempt <= MaxRetryAttempts + 1; attempt++)
        {
            // Re-check circuit and re-enter the rate-limit queue on every attempt so that
            // retry requests respect the same per-key spacing as initial requests.
            circuitBreakerState.ThrowIfOpen(appKeyBucket);
            await rateLimitState.WaitAsync(GetApiKeyBucket(apiKey), UserApiKeyInterval, cancellationToken).ConfigureAwait(false);
            await rateLimitState.WaitAsync(GetApplicationKeyBucket(applicationKey), ApplicationKeyInterval, cancellationToken).ConfigureAwait(false);

            try
            {
                var httpClient = httpClientFactory.CreateClient(AmbientHttpClientName);
                using var response = await httpClient.GetAsync(requestUri, cancellationToken).ConfigureAwait(false);

                if (response.IsSuccessStatusCode)
                {
                    circuitBreakerState.RecordSuccess(appKeyBucket);
                    return await response.Content
                        .ReadFromJsonAsync<T>(AmbientJsonOptions.Default, cancellationToken)
                        .ConfigureAwait(false)
                        ?? throw new InvalidOperationException("Ambient Weather API returned an empty response.");
                }

                ThrowOrContinue(response, attempt, appKeyBucket);
                await DelayBeforeRetryAsync(attempt, response, cancellationToken).ConfigureAwait(false);
            }
            catch (Exception ex) when (IsTransientException(ex, cancellationToken))
            {
                circuitBreakerState.RecordFailure(appKeyBucket, CircuitBreakerFailureThreshold, CircuitBreakerBreakDuration);
                if (attempt > MaxRetryAttempts)
                {
                    throw;
                }

                LogTransientFailureRetry(logger, ex, attempt + 1);
                await DelayBeforeRetryAsync(attempt, response: null, cancellationToken).ConfigureAwait(false);
            }
        }

        throw new InvalidOperationException("Ambient Weather request failed unexpectedly.");
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Transient Ambient Weather request failure. Retrying attempt {Attempt}.")]
    private static partial void LogTransientFailureRetry(ILogger logger, Exception exception, int attempt);

    /// <summary>
    /// For a non-success response: throws immediately for non-transient failures, records a circuit
    /// failure and throws when retries are exhausted, or returns so the caller can delay and retry.
    /// </summary>
    private void ThrowOrContinue(HttpResponseMessage response, int attempt, string appKeyBucket)
    {
        if (!ShouldRetry(response.StatusCode))
        {
            // Non-transient (auth/not-found/other client errors): do not retry and do not
            // increment the circuit-breaker failure counter.
            throw MapHttpError(response.StatusCode);
        }

        if (attempt > MaxRetryAttempts)
        {
            if (response.StatusCode == HttpStatusCode.TooManyRequests)
            {
                // AmbientApiRateLimitException is not caught by IsTransientException, so record
                // the circuit failure here before the exception escapes the try block.
                circuitBreakerState.RecordFailure(appKeyBucket, CircuitBreakerFailureThreshold, CircuitBreakerBreakDuration);
                throw new AmbientApiRateLimitException();
            }

            // For 5xx/408: throw HttpRequestException so IsTransientException catches it and
            // calls RecordFailure exactly once — don't call it here too.
            throw new HttpRequestException(
                string.Format(System.Globalization.CultureInfo.InvariantCulture, "Ambient Weather API returned {0} after {1} retries.", (int)response.StatusCode, MaxRetryAttempts),
                inner: null,
                statusCode: response.StatusCode);
        }

        // Will retry on the next loop iteration: record failure now and return for delay.
        circuitBreakerState.RecordFailure(appKeyBucket, CircuitBreakerFailureThreshold, CircuitBreakerBreakDuration);
    }

    private static bool ShouldRetry(HttpStatusCode statusCode)
    {
        return statusCode is HttpStatusCode.RequestTimeout or HttpStatusCode.TooManyRequests
            || (int)statusCode >= 500;
    }

    private static Exception MapHttpError(HttpStatusCode statusCode) =>
        statusCode switch
        {
            HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden => new AmbientApiAuthException(),
            HttpStatusCode.NotFound => new AmbientApiNotFoundException(),
            _ => new HttpRequestException(string.Format(System.Globalization.CultureInfo.InvariantCulture, "Ambient Weather API returned {0}.", (int)statusCode), inner: null, statusCode: statusCode),
        };

    private static bool IsTransientException(Exception exception, CancellationToken cancellationToken)
    {
        return exception switch
        {
            HttpRequestException { StatusCode: { } statusCode } => ShouldRetry(statusCode),
            HttpRequestException => true,
            TaskCanceledException when !cancellationToken.IsCancellationRequested => true,
            _ => false,
        };
    }

    private async Task DelayBeforeRetryAsync(
        int attempt,
        HttpResponseMessage? response,
        CancellationToken cancellationToken)
    {
        var retryAfter = response?.Headers.RetryAfter?.Delta;
        var delay = CalculateRetryDelay(attempt, BaseRetryDelay, retryAfter, Random.Shared.Next(25, 125));

        await Task.Delay(delay, cancellationToken).ConfigureAwait(false);
    }

    internal static TimeSpan CalculateRetryDelay(
        int attempt,
        TimeSpan baseRetryDelay,
        TimeSpan? retryAfter,
        int jitterMilliseconds)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(attempt, 1);
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(baseRetryDelay, TimeSpan.Zero);
        ArgumentOutOfRangeException.ThrowIfLessThan(jitterMilliseconds, 0);

        var exponentialDelay = TimeSpan.FromMilliseconds(baseRetryDelay.TotalMilliseconds * Math.Pow(2, attempt - 1));
        var jitter = TimeSpan.FromMilliseconds(jitterMilliseconds);

        return retryAfter > exponentialDelay
            ? retryAfter.GetValueOrDefault() + jitter
            : exponentialDelay + jitter;
    }

    private static string GetApiKeyBucket(string? apiKey)
    {
        if (string.IsNullOrWhiteSpace(apiKey)) return "api:default";
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(apiKey));
        return $"api:{Convert.ToHexString(hash).ToLowerInvariant()}";
    }

    private static string GetApplicationKeyBucket(string? applicationKey)
    {
        if (string.IsNullOrWhiteSpace(applicationKey)) return "app:default";
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(applicationKey));
        return $"app:{Convert.ToHexString(hash).ToLowerInvariant()}";
    }

    /// <summary>
    /// Returns the named Ambient REST HttpClient registration name.
    /// </summary>
    public static string HttpClientName => AmbientHttpClientName;
}
