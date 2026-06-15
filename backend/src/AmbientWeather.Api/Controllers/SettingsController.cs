using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.Common;
using AmbientWeather.Application.DTOs.Settings;
using AmbientWeather.Application.Features.Settings.Commands;
using AmbientWeather.Application.Features.Settings.Queries;
using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AmbientWeather.Api.Controllers;

/// <summary>
/// API endpoints for authenticated user settings.
/// </summary>
[ApiController]
[Route("api/settings")]
[Produces("application/json")]
[Authorize(Policy = "AuthenticatedUser")]
[EnableRateLimiting("per-user")]
public sealed class SettingsController(IMediator mediator) : ControllerBase
{
    /// <summary>
    /// Gets safe Ambient Weather credential status for the authenticated user.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>Safe credential status without decrypted values.</returns>
    [HttpGet("credentials")]
    [ProducesResponseType(typeof(AmbientCredentialStatusDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<AmbientCredentialStatusDto>> GetCredentialStatus(
        CancellationToken cancellationToken = default)
    {
        var result = await mediator.Send(new GetAmbientCredentialStatusQuery(), cancellationToken).ConfigureAwait(false);
        return Ok(result);
    }

    /// <summary>
    /// Validates and saves Ambient Weather credentials for the authenticated user.
    /// </summary>
    /// <param name="request">Ambient Weather credentials.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>No content when credentials are saved.</returns>
    [HttpPost("credentials")]
    [EnableRateLimiting("credential-save")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult> SaveCredentials(
        [FromBody] SaveAmbientCredentialsRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await mediator.Send(
                new SaveAmbientCredentialsCommand(request.ApiKey, request.ApplicationKey),
                cancellationToken).ConfigureAwait(false);

            return NoContent();
        }
        catch (ValidationException ex)
        {
            return BadRequest(new ErrorResponseDto
            {
                Error = "validation-failed",
                Message = string.Join("; ", ex.Errors.Select(e => e.ErrorMessage)),
                StatusCode = StatusCodes.Status400BadRequest
            });
        }
        catch (HttpRequestException)
        {
            return BadRequest(new ErrorResponseDto
            {
                Error = "ambient-credentials-invalid",
                Message = "Ambient Weather credentials could not be validated.",
                StatusCode = StatusCodes.Status400BadRequest
            });
        }
        catch (AmbientApiAuthException)
        {
            return BadRequest(new ErrorResponseDto
            {
                Error = "ambient-credentials-invalid",
                Message = "Ambient Weather credentials could not be validated.",
                StatusCode = StatusCodes.Status400BadRequest
            });
        }
    }

    /// <summary>
    /// Deletes stored Ambient Weather credentials for the authenticated user.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>No content when credentials are deleted or already absent.</returns>
    [HttpDelete("credentials")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<ActionResult> DeleteCredentials(CancellationToken cancellationToken = default)
    {
        await mediator.Send(new DeleteAmbientCredentialsCommand(), cancellationToken).ConfigureAwait(false);
        return NoContent();
    }

    /// <summary>
    /// Gets display preferences (units, date format, and theme) for the authenticated user.
    /// Returns defaults on first use.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>The user's current preferences.</returns>
    [HttpGet("preferences")]
    [ProducesResponseType(typeof(UserPreferencesDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<UserPreferencesDto>> GetPreferences(
        CancellationToken cancellationToken = default)
    {
        var result = await mediator.Send(new GetUserPreferencesQuery(), cancellationToken).ConfigureAwait(false);
        return Ok(result);
    }

    /// <summary>
    /// Updates display preferences (units, date format, and theme) for the authenticated user.
    /// </summary>
    /// <param name="request">The updated preference values.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>The saved preferences.</returns>
    [HttpPut("preferences")]
    [ProducesResponseType(typeof(UserPreferencesDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<UserPreferencesDto>> UpdatePreferences(
        [FromBody] UpdateUserPreferencesRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await mediator.Send(
                new UpdateUserPreferencesCommand(
                    request.TemperatureUnit,
                    request.SpeedUnit,
                    request.PressureUnit,
                    request.RainfallUnit,
                    request.DistanceUnit,
                    request.Theme,
                    request.DateFormat,
                    request.TemperatureDecimals,
                    request.DailyExtremaTimezone),
                cancellationToken).ConfigureAwait(false);

            return Ok(result);
        }
        catch (ValidationException ex)
        {
            return BadRequest(new ErrorResponseDto
            {
                Error = "validation-failed",
                Message = string.Join("; ", ex.Errors.Select(e => e.ErrorMessage)),
                StatusCode = StatusCodes.Status400BadRequest,
            });
        }
    }

    // -------------------------------------------------------------------------
    // Device settings
    // -------------------------------------------------------------------------

    /// <summary>
    /// Returns all Ambient Weather stations owned by the authenticated user.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>The user's owned stations with their settings.</returns>
    [HttpGet("devices")]
    [ProducesResponseType(typeof(IReadOnlyList<SettingsDeviceDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<SettingsDeviceDto>>> GetDevices(
        CancellationToken cancellationToken = default)
    {
        var result = await mediator.Send(new GetSettingsDevicesQuery(), cancellationToken).ConfigureAwait(false);
        return Ok(result);
    }

    /// <summary>
    /// Syncs the authenticated user's Ambient Weather devices into the local station store.
    /// Requires saved credentials. Preserves user-managed settings across syncs.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>The synced stations after upsert.</returns>
    [HttpPost("devices/sync")]
    [ProducesResponseType(typeof(IReadOnlyList<SettingsDeviceDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<IReadOnlyList<SettingsDeviceDto>>> SyncDevices(
        CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await mediator.Send(new SyncSettingsDevicesCommand(), cancellationToken).ConfigureAwait(false);
            return Ok(result);
        }
        catch (AmbientApiAuthException)
        {
            return BadRequest(new ErrorResponseDto
            {
                Error = "ambient-credentials-invalid",
                Message = "Stored credentials could not be used to contact Ambient Weather.",
                StatusCode = StatusCodes.Status400BadRequest,
            });
        }
    }

    /// <summary>
    /// Updates user-managed settings for an owned station.
    /// All body fields use patch semantics: omit or null to leave unchanged.
    /// </summary>
    /// <param name="mac">The station MAC address.</param>
    /// <param name="request">The fields to update.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>No content on success.</returns>
    [HttpPut("devices/{mac}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status404NotFound)]
    public async Task<ActionResult> UpdateDevice(
        [FromRoute] string mac,
        [FromBody] UpdateSettingsDeviceRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await mediator.Send(
                new UpdateSettingsDeviceCommand(
                    mac,
                    request.Nickname,
                    request.IsPrimary,
                    request.DisplayOnDashboard,
                    request.SelectedMetricKeys),
                cancellationToken).ConfigureAwait(false);

            return NoContent();
        }
        catch (ValidationException ex)
        {
            return BadRequest(new ErrorResponseDto
            {
                Error = "validation-failed",
                Message = string.Join("; ", ex.Errors.Select(e => e.ErrorMessage)),
                StatusCode = StatusCodes.Status400BadRequest,
            });
        }
        catch (AmbientApiNotFoundException)
        {
            return NotFound(new ErrorResponseDto
            {
                Error = "station-not-found",
                Message = "No station with that MAC address was found for your account.",
                StatusCode = StatusCodes.Status404NotFound,
            });
        }
    }
}
