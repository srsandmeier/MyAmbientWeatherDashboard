using AmbientWeather.Application.DTOs.Dashboard;
using AmbientWeather.Application.DTOs.Realtime;
using AmbientWeather.Application.Features.Dashboard.Commands;
using AmbientWeather.Application.Features.Dashboard.Queries;
using AmbientWeather.Application.Features.Neighbors.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AmbientWeather.Api.Controllers;

/// <summary>
/// BFF endpoints for the main dashboard page.
/// </summary>
[ApiController]
[Route("api/dashboard")]
[Authorize(Policy = "AuthenticatedUser")]
[EnableRateLimiting("per-user")]
public sealed class DashboardController(ISender mediator) : ControllerBase
{
    /// <summary>
    /// Returns the latest current reading for the user's default weather station,
    /// or an aggregated neighbor reading when <paramref name="source"/> is <c>neighbors</c>.
    /// </summary>
    /// <param name="source">
    /// Data source: <c>own</c> (default) for the user's own station;
    /// <c>neighbors</c> for an aggregated reading from nearby public stations.
    /// </param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <response code="200">Latest reading.</response>
    /// <response code="401">Not authenticated.</response>
    /// <response code="428">No credentials/station configured, or neighbor feature unavailable.</response>
    /// <response code="429">Rate limit exceeded.</response>
    /// <response code="503">Ambient circuit breaker is open.</response>
    [HttpGet("current")]
    [ProducesResponseType<CurrentReadingDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status428PreconditionRequired)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<CurrentReadingDto>> GetCurrent(
        [FromQuery] string? source,
        CancellationToken cancellationToken)
    {
        var result = string.Equals(source, "neighbors", StringComparison.OrdinalIgnoreCase)
            ? await mediator.Send(new GetNeighborCurrentReadingQuery(), cancellationToken).ConfigureAwait(false)
            : await mediator.Send(new GetCurrentReadingQuery(), cancellationToken).ConfigureAwait(false);
        return Ok(result);
    }

    /// <summary>
    /// Returns a rainfall accumulation snapshot for the user's default weather station.
    /// Reads from the server-side latest-reading cache first; falls back to the Ambient REST API
    /// on cache miss.
    /// </summary>
    /// <response code="200">Rainfall accumulation values for the primary station.</response>
    /// <response code="401">Not authenticated.</response>
    /// <response code="428">No Ambient credentials saved or no station configured.</response>
    /// <response code="429">Rate limit exceeded.</response>
    /// <response code="503">Ambient circuit breaker is open.</response>
    [HttpGet("rainfall")]
    [ProducesResponseType<DashboardRainfallDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status428PreconditionRequired)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<DashboardRainfallDto>> GetRainfall(CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new GetDashboardRainfallQuery(), cancellationToken)
            .ConfigureAwait(false);
        return Ok(result);
    }

    /// <summary>
    /// Returns the user's active dashboard layout, seeding a suggested default on first access.
    /// </summary>
    /// <response code="200">The active layout with all tile configurations.</response>
    /// <response code="401">Not authenticated.</response>
    /// <response code="429">Rate limit exceeded.</response>
    [HttpGet("layout")]
    [ProducesResponseType<DashboardLayoutDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<DashboardLayoutDto>> GetLayout(CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new GetDashboardLayoutQuery(), cancellationToken)
            .ConfigureAwait(false);
        return Ok(result);
    }

    /// <summary>
    /// Returns the daily high/low outdoor and indoor temperatures for the user's default station,
    /// computed from stored readings for the current UTC calendar day.
    /// Returns null values for any sensor that has no readings today.
    /// </summary>
    /// <response code="200">Daily temperature extrema for the primary station.</response>
    /// <response code="401">Not authenticated.</response>
    /// <response code="428">No Ambient credentials saved or no station configured.</response>
    /// <response code="429">Rate limit exceeded.</response>
    [HttpGet("daily-extremes")]
    [ProducesResponseType<DailyExtremaDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status428PreconditionRequired)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<DailyExtremaDto>> GetDailyExtrema(CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new GetDashboardDailyExtremaQuery(), cancellationToken)
            .ConfigureAwait(false);
        return Ok(result);
    }

    /// <summary>
    /// Saves the user's dashboard tile layout.
    /// Validates tile structure, metric keys, and metric reference format before persisting.
    /// Station IDs in custom items are display configuration and are not validated against ownership.
    /// </summary>
    /// <response code="200">The saved layout echoed back with its persisted identifier and timestamp.</response>
    /// <response code="400">Validation failed — invalid tile structure or unrecognized metric key.</response>
    /// <response code="401">Not authenticated.</response>
    /// <response code="429">Rate limit exceeded.</response>
    [HttpPut("layout")]
    [ProducesResponseType<DashboardLayoutDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<DashboardLayoutDto>> PutLayout(
        [FromBody] SaveDashboardLayoutCommand command,
        CancellationToken cancellationToken)
    {
        var result = await mediator.Send(command, cancellationToken)
            .ConfigureAwait(false);
        return Ok(result);
    }
}
