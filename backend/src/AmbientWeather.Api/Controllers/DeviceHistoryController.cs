using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.AmbientApi;
using AmbientWeather.Application.DTOs.Common;
using AmbientWeather.Application.Features.DeviceHistory.Queries;
using AmbientWeather.Application.Interfaces;
using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AmbientWeather.Api.Controllers;

/// <summary>
/// API endpoints for retrieving and managing device weather history.
/// </summary>
[ApiController]
[Route("api/v1/devices")]
[Produces("application/json")]
[Authorize(Policy = "AuthenticatedUser")]
[EnableRateLimiting("per-user")]
public class DeviceHistoryController(
    IMediator mediator,
    IDeviceHistoryService deviceHistoryService,
    ICurrentUserService currentUserService,
    IUserStationStore stationStore,
    ILogger<DeviceHistoryController> logger) : ControllerBase
{
    /// <summary>
    /// Retrieves historical weather readings for a specific device.
    /// Returns up to 288 readings (typically 24 hours of 5-minute intervals).
    /// </summary>
    /// <param name="macAddress">
    /// The MAC address of the device (primary identifier from Ambient Weather).
    /// Example: "00:11:22:33:44:55"
    /// </param>
    /// <param name="limit">
    /// Maximum number of readings to return.
    /// Default: 288 (24 hours at 5-minute intervals).
    /// Maximum: 288.
    /// </param>
    /// <param name="endDate">
    /// Optional end date for the query in ISO 8601 format (yyyy-MM-dd).
    /// If not provided, returns the most recent readings.
    /// Example: "2026-05-27"
    /// </param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <response code="200">Successfully retrieved device history.</response>
    /// <response code="400">Invalid request parameters.</response>
    /// <response code="404">Device not found or no data available.</response>
    /// <response code="503">Ambient Weather API is temporarily unavailable.</response>
    [HttpGet("{macAddress}/history")]
    [ProducesResponseType(typeof(DeviceHistoryResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<DeviceHistoryResponseDto>> GetDeviceHistory(
        [FromRoute] string macAddress,
        [FromQuery(Name = "limit")] int limit = 288,
        [FromQuery(Name = "endDate")] DateTime? endDate = null,
        CancellationToken cancellationToken = default)
    {
        DeviceHistoryControllerLogs.DeviceHistoryRequested(logger, macAddress, limit, endDate);

        try
        {
            var history = await mediator.Send(
                new GetDeviceHistoryQuery(macAddress, limit, endDate),
                cancellationToken);

            if (history?.Readings == null || history.Readings.Count == 0)
            {
                DeviceHistoryControllerLogs.DeviceNotFound(logger, macAddress);
                return NotFound(new ErrorResponseDto
                {
                    Error = "Device not found",
                    Message = $"No data available for device {macAddress}. Verify the MAC address and try again.",
                    StatusCode = 404
                });
            }

            if (logger.IsEnabled(LogLevel.Information))
                DeviceHistoryControllerLogs.DeviceHistoryRetrieved(logger, macAddress, history.Readings.Count);

            return Ok(history);
        }
        catch (ValidationException ex)
        {
            var message = string.Join("; ", ex.Errors.Select(e => e.ErrorMessage));
            return BadRequest(new ErrorResponseDto { Error = "validation-failed", Message = message, StatusCode = 400 });
        }
        catch (HttpRequestException ex)
        {
            DeviceHistoryControllerLogs.AmbientApiUnavailable(logger, ex);
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new ErrorResponseDto
            {
                Error = "external-service-error",
                Message = "Unable to retrieve data from Ambient Weather API. Please try again later.",
                StatusCode = 503
            });
        }
        catch (OperationCanceledException)
        {
            DeviceHistoryControllerLogs.DeviceHistoryRequestCancelled(logger, macAddress);
            return StatusCode(StatusCodes.Status408RequestTimeout, new ErrorResponseDto
            {
                Error = "request-timeout",
                Message = "The request was cancelled or timed out. Please try again.",
                StatusCode = 408
            });
        }
    }

    /// <summary>
    /// Invalidates the cache for a specific device.
    /// Call this endpoint when you need fresh data without waiting for the cache to expire.
    /// </summary>
    /// <param name="macAddress">The MAC address of the device.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <response code="204">Cache invalidated successfully.</response>
    /// <response code="400">Invalid MAC address format.</response>
    [HttpDelete("{macAddress}/cache")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult> InvalidateDeviceCache(
        [FromRoute] string macAddress,
        CancellationToken cancellationToken = default)
    {
        DeviceHistoryControllerLogs.CacheInvalidationRequested(logger, macAddress);

        if (!MacAddressValidator.IsValid(macAddress))
        {
            DeviceHistoryControllerLogs.InvalidMacAddressForCacheInvalidation(logger, macAddress);
            return BadRequest(new ErrorResponseDto
            {
                Error = "Invalid MAC address format",
                Message = "MAC address must be in format: XX:XX:XX:XX:XX:XX",
                StatusCode = 400
            });
        }

        await VerifyDeviceOwnershipAsync(macAddress, cancellationToken).ConfigureAwait(false);

        await deviceHistoryService.InvalidateCacheAsync(macAddress, cancellationToken);
        DeviceHistoryControllerLogs.CacheInvalidated(logger, macAddress);

        return NoContent();
    }

    /// <summary>
    /// Verifies the authenticated user owns the device with the given MAC address.
    /// Throws <see cref="AmbientApiNotFoundException"/> when the device does not belong to the user.
    /// </summary>
    /// <param name="macAddress">The MAC address of the device to verify.</param>
    /// <param name="ct">Cancellation token for async operations.</param>
    private async Task VerifyDeviceOwnershipAsync(string macAddress, CancellationToken ct)
    {
        var subject = currentUserService.RequireAuthenticatedUser();
        var station = await stationStore.GetOwnedStationByMacAsync(subject, macAddress, ct).ConfigureAwait(false);
        if (station is null)
            throw new AmbientApiNotFoundException();
    }
}
