using AmbientWeather.Application.DTOs.AmbientApi;

namespace AmbientWeather.Application.Interfaces;

/// <summary>
/// Service for retrieving and managing device weather history from Ambient Weather API.
/// Handles caching, rate limiting, and data transformation.
/// </summary>
public interface IDeviceHistoryService
{
    /// <summary>
    /// Retrieves historical weather readings for a specific device.
    /// </summary>
    /// <param name="macAddress">The MAC address of the device (primary identifier).</param>
    /// <param name="limit">Maximum number of readings to return. Default: 288 (24 hours of 5-min intervals). Max: 288.</param>
    /// <param name="endDate">Optional end date for the query. If not provided, retrieves most recent readings.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>Device history response containing weather readings and pagination metadata.</returns>
    /// <exception cref="ArgumentException">Thrown when macAddress is null/empty or limit exceeds maximum.</exception>
    /// <exception cref="HttpRequestException">Thrown when API request fails.</exception>
    Task<DeviceHistoryResponseDto> GetDeviceHistoryAsync(
        string macAddress,
        int limit = 288,
        DateTime? endDate = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves cached device history if available and not stale.
    /// </summary>
    /// <param name="macAddress">The MAC address of the device.</param>
    /// <param name="limit">Maximum number of readings requested.</param>
    /// <param name="endDate">Optional end date for the query.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>Cached history or null if not available/stale.</returns>
    Task<DeviceHistoryResponseDto?> GetCachedHistoryAsync(
        string macAddress,
        int limit = 288,
        DateTime? endDate = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Invalidates the cache for a specific device.
    /// </summary>
    /// <param name="macAddress">The MAC address of the device.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    Task InvalidateCacheAsync(string macAddress, CancellationToken cancellationToken = default);

    /// <summary>
    /// Invalidates all cached device history.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    Task InvalidateAllCachesAsync(CancellationToken cancellationToken = default);
}
