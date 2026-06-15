using AmbientWeather.Application.DTOs.Alerts;
using AmbientWeather.Application.Features.Alerts.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AmbientWeather.Api.Controllers;

/// <summary>
/// API endpoints for public weather alerts.
/// </summary>
[ApiController]
[Route("api/alerts")]
[Produces("application/json")]
[Authorize(Policy = "AuthenticatedUser")]
[EnableRateLimiting("per-user")]
public sealed class AlertsController(IMediator mediator) : ControllerBase
{
    /// <summary>
    /// Returns active public weather alerts for the authenticated user's default station area or a selected Weather.gov area code.
    /// </summary>
    /// <param name="area">Optional Weather.gov area, zone, or state code.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>Active weather alerts, or an empty list when no alert source is available.</returns>
    [HttpGet("active")]
    [ProducesResponseType(typeof(IReadOnlyList<WeatherAlertDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<IReadOnlyList<WeatherAlertDto>>> GetActiveAlerts(
        [FromQuery] string? area,
        CancellationToken cancellationToken = default)
    {
        var result = await mediator.Send(new GetActiveAlertsQuery(area), cancellationToken).ConfigureAwait(false);
        return Ok(result);
    }
}
