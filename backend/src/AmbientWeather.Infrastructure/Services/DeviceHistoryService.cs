using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.AmbientApi;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Infrastructure.Ambient;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;

namespace AmbientWeather.Infrastructure.Services;

/// <summary>
/// Implementation of device history service with distributed caching and rate limiting.
/// Caches API responses to reduce calls to the Ambient Weather API.
/// </summary>
public class DeviceHistoryService(
    IAmbientRestClient restClient,
    IAmbientCredentialStore credentialStore,
    ICurrentUserService currentUserService,
    IDistributedCache cache,
    ILogger<DeviceHistoryService> logger) : IDeviceHistoryService
{
    private readonly IAmbientRestClient _restClient = restClient ?? throw new ArgumentNullException(nameof(restClient));
    private readonly IAmbientCredentialStore _credentialStore = credentialStore ?? throw new ArgumentNullException(nameof(credentialStore));
    private readonly ICurrentUserService _currentUserService = currentUserService ?? throw new ArgumentNullException(nameof(currentUserService));
    private readonly IDistributedCache _cache = cache ?? throw new ArgumentNullException(nameof(cache));
    private readonly ILogger<DeviceHistoryService> _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    private readonly TimeSpan _cacheDuration = TimeSpan.FromMinutes(5);
    private readonly TimeSpan _versionCacheDuration = TimeSpan.FromDays(1);
    private const int MaxLimit = 288;

    /// <summary>
    /// Retrieves historical weather readings for a specific device.
    /// Attempts to use cached data first if available and not stale.
    /// </summary>
    public async Task<DeviceHistoryResponseDto> GetDeviceHistoryAsync(
        string macAddress,
        int limit = 288,
        DateTime? endDate = null,
        CancellationToken cancellationToken = default)
    {
        // Validation
        if (string.IsNullOrWhiteSpace(macAddress))
        {
            throw new ArgumentException("MAC address cannot be null or empty.", nameof(macAddress));
        }

        if (!MacAddressValidator.IsValid(macAddress))
        {
            throw new ArgumentException(
                "MAC address must be in format XX:XX:XX:XX:XX:XX, XX-XX-XX-XX-XX-XX, or XXXXXXXXXXXX.",
                nameof(macAddress));
        }

        if (limit <= 0 || limit > MaxLimit)
        {
            throw new ArgumentException($"Limit must be between 1 and {MaxLimit}.", nameof(limit));
        }

        // Attempt to retrieve from cache. GetCachedHistoryAsync handles cache misses internally.
        var cached = await GetCachedHistoryAsync(macAddress, limit, endDate, cancellationToken).ConfigureAwait(false);
        if (cached != null)
        {
            DeviceHistoryServiceLogs.DeviceHistoryRetrievedFromCache(_logger, macAddress);
            return cached;
        }

        try
        {
            DeviceHistoryServiceLogs.FetchingDeviceHistory(_logger, macAddress, limit, endDate);

            var credentials = await GetCurrentUserCredentialsAsync(cancellationToken).ConfigureAwait(false);

            // Call the REST client to fetch from Ambient Weather API with server-side stored credentials.
            var history = await _restClient.GetDeviceHistoryAsync(
                macAddress,
                credentials.ApiKey,
                credentials.ApplicationKey,
                limit,
                endDate,
                cancellationToken).ConfigureAwait(false);

            await CacheHistoryAsync(macAddress, limit, endDate, history, cancellationToken).ConfigureAwait(false);

            if (_logger.IsEnabled(LogLevel.Information))
            {
                DeviceHistoryServiceLogs.DeviceHistoryCached(
                    _logger,
                    macAddress,
                    history?.Readings?.Count ?? 0);
            }

            return history!;
        }
        catch (HttpRequestException ex)
        {
            DeviceHistoryServiceLogs.FetchHistoryFailed(_logger, ex, macAddress);
            throw;
        }
    }

    private async Task<AmbientCredentials> GetCurrentUserCredentialsAsync(CancellationToken cancellationToken)
    {
        var authProviderSubject = _currentUserService.RequireAuthenticatedUser();
        return await _credentialStore.GetAsync(authProviderSubject, cancellationToken).ConfigureAwait(false)
            ?? throw new AmbientCredentialsRequiredException();
    }

    /// <summary>
    /// Retrieves cached device history if available and not stale.
    /// </summary>
    public async Task<DeviceHistoryResponseDto?> GetCachedHistoryAsync(
        string macAddress,
        int limit = 288,
        DateTime? endDate = null,
        CancellationToken cancellationToken = default)
    {
        if (!MacAddressValidator.IsValid(macAddress))
        {
            return null;
        }

        if (limit <= 0 || limit > MaxLimit)
        {
            return null;
        }

        try
        {
            var cacheKey = await BuildCacheKeyAsync(macAddress, limit, endDate, cancellationToken).ConfigureAwait(false);
            var cachedJson = await _cache.GetStringAsync(cacheKey, cancellationToken).ConfigureAwait(false);

            return string.IsNullOrWhiteSpace(cachedJson)
                ? null
                : JsonSerializer.Deserialize<DeviceHistoryResponseDto>(cachedJson, AmbientJsonOptions.Default);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            DeviceHistoryServiceLogs.CacheRetrievalFailed(_logger, ex, macAddress);
            return null;
        }
    }

    /// <summary>
    /// Invalidates the cache for a specific device.
    /// Useful when manual refresh is needed or data is known to be stale.
    /// </summary>
    public async Task InvalidateCacheAsync(string macAddress, CancellationToken cancellationToken = default)
    {
        if (!MacAddressValidator.IsValid(macAddress))
        {
            return;
        }

        try
        {
            await _cache.RemoveAsync(BuildDeviceVersionKey(macAddress), cancellationToken).ConfigureAwait(false);
            DeviceHistoryServiceLogs.CacheInvalidated(_logger, macAddress);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            DeviceHistoryServiceLogs.CacheInvalidationFailed(_logger, ex, macAddress);
        }
    }

    /// <summary>
    /// Invalidates all cached device history for the current user.
    /// </summary>
    public async Task InvalidateAllCachesAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            await _cache.SetStringAsync(
                BuildUserAllVersionKey(),
                CreateCacheVersion(),
                VersionCacheOptions(),
                cancellationToken).ConfigureAwait(false);

            DeviceHistoryServiceLogs.AllCachesInvalidated(_logger);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            DeviceHistoryServiceLogs.AllCachesInvalidationFailed(_logger, ex);
        }
    }

    /// <summary>
    /// Stores device history in the distributed cache.
    /// </summary>
    private async Task CacheHistoryAsync(
        string macAddress,
        int limit,
        DateTime? endDate,
        DeviceHistoryResponseDto history,
        CancellationToken cancellationToken)
    {
        try
        {
            var cacheKey = await BuildCacheKeyAsync(macAddress, limit, endDate, cancellationToken).ConfigureAwait(false);
            var cachedJson = JsonSerializer.Serialize(history, AmbientJsonOptions.Default);

            await _cache.SetStringAsync(
                cacheKey,
                cachedJson,
                new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = _cacheDuration,
                },
                cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            DeviceHistoryServiceLogs.CacheWriteFailed(_logger, ex, macAddress);
        }
    }

    /// <summary>
    /// Builds a cache key that includes every request input that changes the response,
    /// including the user identity so that different users never share cache entries.
    /// The user segment is computed once and passed to version-key helpers to avoid
    /// redundant claim lookups.
    /// </summary>
    private async Task<string> BuildCacheKeyAsync(
        string macAddress,
        int limit,
        DateTime? endDate,
        CancellationToken cancellationToken)
    {
        var userSegment = GetUserSegment();
        var userAllVersion = await GetOrCreateVersionAsync(BuildUserAllVersionKey(userSegment), cancellationToken).ConfigureAwait(false);
        var deviceVersion = await GetOrCreateVersionAsync(BuildDeviceVersionKey(macAddress, userSegment), cancellationToken).ConfigureAwait(false);
        var normalizedMac = NormalizeMacAddress(macAddress);
        var normalizedEndDate = endDate?.ToUniversalTime().ToString("yyyyMMddHHmmss", CultureInfo.InvariantCulture) ?? "latest";

        return $"device-history:u:{userSegment}:v:{userAllVersion}:d:{deviceVersion}:mac:{normalizedMac}:limit:{limit.ToString(CultureInfo.InvariantCulture)}:end:{normalizedEndDate}";
    }

    /// <summary>
    /// Gets a cache namespace version, creating one when absent.
    /// </summary>
    private async Task<string> GetOrCreateVersionAsync(string key, CancellationToken cancellationToken)
    {
        var version = await _cache.GetStringAsync(key, cancellationToken).ConfigureAwait(false);
        if (!string.IsNullOrWhiteSpace(version))
        {
            return version;
        }

        version = CreateCacheVersion();
        await _cache.SetStringAsync(key, version, VersionCacheOptions(), cancellationToken).ConfigureAwait(false);

        return version;
    }

    private DistributedCacheEntryOptions VersionCacheOptions() =>
        new()
        {
            AbsoluteExpirationRelativeToNow = _versionCacheDuration,
        };

    private string BuildUserAllVersionKey() =>
        BuildUserAllVersionKey(GetUserSegment());

    private static string BuildUserAllVersionKey(string userSegment) =>
        $"device-history:user-version:u:{userSegment}";

    private string BuildDeviceVersionKey(string macAddress) =>
        BuildDeviceVersionKey(macAddress, GetUserSegment());

    private static string BuildDeviceVersionKey(string macAddress, string userSegment) =>
        $"device-history:device-version:u:{userSegment}:mac:{NormalizeMacAddress(macAddress)}";

    private static string NormalizeMacAddress(string macAddress) =>
        MacAddressValidator.Normalize(macAddress);

    private static string CreateCacheVersion() =>
        Guid.NewGuid().ToString("N", CultureInfo.InvariantCulture);

    /// <summary>
    /// Returns a SHA-256 hash of the auth-provider subject, keeping user identifiers
    /// out of Redis key names while still providing per-user cache isolation.
    /// Falls back to "anonymous" when no authenticated user is present.
    /// </summary>
    private string GetUserSegment()
    {
        var subject = _currentUserService.AuthProviderSubject;
        if (string.IsNullOrWhiteSpace(subject))
            return "anonymous";
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(subject));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
