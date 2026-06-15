using AmbientWeather.Application.DTOs.AmbientApi;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Application.Common;

namespace AmbientWeather.Infrastructure.Ambient;

/// <summary>
/// HTTP client for the Ambient Weather REST API.
/// Handles device queries and single-page historical data retrieval.
/// All calls are routed through <see cref="RateLimitedApiClient"/> so rate limiting,
/// retry, and circuit-breaker behavior are centrally enforced.
/// </summary>
public class AmbientRestClient(RateLimitedApiClient apiClient) : IAmbientRestClient
{
    /// <summary>
    /// Retrieves all devices associated with the provided API credentials.
    /// </summary>
    /// <param name="apiKey">The Ambient user API key.</param>
    /// <param name="applicationKey">The Ambient application key.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>All devices with their most-recent sensor readings and metadata.</returns>
    public async Task<IReadOnlyList<DeviceDto>> GetDevicesAsync(
        string apiKey,
        string applicationKey,
        CancellationToken cancellationToken = default)
    {
        var requestUri =
            $"devices?applicationKey={Uri.EscapeDataString(applicationKey)}&apiKey={Uri.EscapeDataString(apiKey)}";

        var devices = await apiClient.GetFromJsonAsync<List<DeviceDto>>(
            requestUri,
            apiKey,
            applicationKey,
            cancellationToken).ConfigureAwait(false);

        return devices;
    }

    /// <summary>
    /// Retrieves a single page of historical weather readings for one device.
    /// This is a low-level primitive that returns at most <paramref name="limit"/> records
    /// ending at or before <paramref name="endDate"/>. Phase 8 builds multi-page range/date
    /// fetching on top of this method.
    /// </summary>
    /// <param name="macAddress">The MAC address of the target device.</param>
    /// <param name="apiKey">The Ambient user API key.</param>
    /// <param name="applicationKey">The Ambient application key.</param>
    /// <param name="limit">
    /// Maximum readings to return. Must be between 1 and 288 inclusive (Ambient's documented
    /// maximum). At 5-minute resolution, 288 records covers roughly one day.
    /// </param>
    /// <param name="endDate">
    /// Return readings at or before this UTC date/time. Sent to Ambient as an epoch
    /// millisecond timestamp so that Phase 8 can target exact day boundaries.
    /// Omit to receive the most recent readings.
    /// </param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>A single-page history response containing up to <paramref name="limit"/> readings.</returns>
    public async Task<DeviceHistoryResponseDto> GetDeviceHistoryAsync(
        string macAddress,
        string apiKey,
        string applicationKey,
        int limit = 288,
        DateTime? endDate = null,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(macAddress))
        {
            throw new ArgumentException("MAC address cannot be null or empty.", nameof(macAddress));
        }

        if (limit is <= 0 or > 288)
        {
            throw new ArgumentException("Limit must be between 1 and 288.", nameof(limit));
        }

        var providerMacAddress = MacAddressValidator.ToColonSeparated(macAddress);
        var requestUri =
            $"devices/{Uri.EscapeDataString(providerMacAddress)}?applicationKey={Uri.EscapeDataString(applicationKey)}&apiKey={Uri.EscapeDataString(apiKey)}&limit={limit}";

        if (endDate.HasValue)
        {
            // Ambient accepts epoch milliseconds; a full datetime (not date-only) lets Phase 8
            // target exact end-of-day boundaries. Treat Unspecified as UTC so server local-time
            // zones do not silently shift the boundary.
            var utcEnd = endDate.Value.Kind switch
            {
                DateTimeKind.Utc => endDate.Value,
                DateTimeKind.Local => endDate.Value.ToUniversalTime(),
                _ => DateTime.SpecifyKind(endDate.Value, DateTimeKind.Utc)
            };
            requestUri += $"&endDate={(long)(utcEnd - DateTime.UnixEpoch).TotalMilliseconds}";
        }

        var readings = await apiClient.GetFromJsonAsync<List<WeatherReadingDto>>(
            requestUri,
            apiKey,
            applicationKey,
            cancellationToken).ConfigureAwait(false);

        return new DeviceHistoryResponseDto
        {
            Readings = readings ?? [],
            TotalReadings = readings?.Count ?? 0,
            Pagination = new PaginationMetadataDto
            {
                PageNumber = 1,
                PageSize = limit,
                TotalPages = 1,
                HasNextPage = false,
                HasPreviousPage = false
            }
        };
    }
}
