using AmbientWeather.Application.DTOs.AmbientApi;

namespace AmbientWeather.Application.Interfaces;

/// <summary>
/// HTTP client for communicating with the Ambient Weather API.
/// Handles authentication and request/response mapping.
/// </summary>
public interface IAmbientRestClient
{
    /// <summary>
    /// Retrieves all devices associated with the provided API credentials.
    /// </summary>
    /// <param name="apiKey">Personal API key from Ambient Weather account.</param>
    /// <param name="applicationKey">Application key for the API.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>List of devices with their current data and metadata.</returns>
    Task<IReadOnlyList<DeviceDto>> GetDevicesAsync(
        string apiKey,
        string applicationKey,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves historical weather readings for a specific device using explicit Ambient credentials.
    /// </summary>
    /// <param name="macAddress">The MAC address of the device.</param>
    /// <param name="apiKey">Personal API key from Ambient Weather account.</param>
    /// <param name="applicationKey">Application key for the API.</param>
    /// <param name="limit">Maximum number of readings to return.</param>
    /// <param name="endDate">Optional end date for the query.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>Device history response containing weather readings.</returns>
    Task<DeviceHistoryResponseDto> GetDeviceHistoryAsync(
        string macAddress,
        string apiKey,
        string applicationKey,
        int limit = 288,
        DateTime? endDate = null,
        CancellationToken cancellationToken = default);
}
