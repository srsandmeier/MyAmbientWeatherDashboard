using AmbientWeather.Application.DTOs.Neighbors;
using AmbientWeather.Application.DTOs.Realtime;
using AmbientWeather.Application.Features.Neighbors.Commands;
using AmbientWeather.Application.Features.Neighbors.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using AmbientWeather.Infrastructure.Neighbors;
using Microsoft.Extensions.Configuration;

namespace AmbientWeather.Api.Controllers;

/// <summary>
/// BFF endpoints for neighbor public-station comparison.
/// </summary>
[ApiController]
[Route("api/neighbors")]
[Authorize(Policy = "AuthenticatedUser")]
[EnableRateLimiting("per-user")]
public sealed class NeighborsController(ISender mediator, IConfiguration configuration) : ControllerBase
{
    private bool IsAmbientOpenAvailable =>
        configuration.GetValue<bool>("Features:AmbientOpenApiEnabled");

    /// <summary>
    /// Returns the neighbor comparison configuration for the authenticated user,
    /// seeding defaults on first access. Includes <c>isAmbientOpenAvailable</c> so
    /// the frontend can enable or disable the provider checkbox accordingly.
    /// </summary>
    /// <response code="200">Neighbor configuration.</response>
    /// <response code="401">Not authenticated.</response>
    [HttpGet("config")]
    [ProducesResponseType<NeighborConfigDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<NeighborConfigDto>> GetConfig(CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new GetNeighborConfigQuery(), cancellationToken)
            .ConfigureAwait(false);
        return Ok(result with { IsAmbientOpenAvailable = IsAmbientOpenAvailable, AmbientOpenMaxRadiusMiles = AmbientOpenWeatherProvider.MaxEffectiveRadiusMiles });
    }

    /// <summary>
    /// Updates the neighbor comparison configuration for the authenticated user.
    /// </summary>
    /// <response code="200">Updated neighbor configuration.</response>
    /// <response code="400">Validation error.</response>
    /// <response code="401">Not authenticated.</response>
    [HttpPut("config")]
    [ProducesResponseType<NeighborConfigDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<NeighborConfigDto>> PutConfig(
        [FromBody] UpdateNeighborConfigCommand command,
        CancellationToken cancellationToken)
    {
        var result = await mediator.Send(command, cancellationToken).ConfigureAwait(false);
        return Ok(result with { IsAmbientOpenAvailable = IsAmbientOpenAvailable, AmbientOpenMaxRadiusMiles = AmbientOpenWeatherProvider.MaxEffectiveRadiusMiles });
    }

    /// <summary>
    /// Clears the neighbor station cache and triggers an immediate re-discovery.
    /// Returns the refreshed station list.
    /// </summary>
    /// <response code="200">Refreshed list of nearby public stations.</response>
    /// <response code="401">Not authenticated.</response>
    /// <response code="428">Neighbor feature is disabled or no station coordinates are configured.</response>
    /// <response code="429">Rate limit exceeded.</response>
    /// <summary>
    /// Returns the most recently cached observation for a single pinned station.
    /// </summary>
    /// <response code="200">Current reading for the pinned station.</response>
    /// <response code="401">Not authenticated.</response>
    /// <response code="404">Station not found in cache — refresh neighbor stations first.</response>
    /// <response code="428">Neighbor comparison is disabled.</response>
    [HttpGet("stations/current")]
    [ProducesResponseType<CurrentReadingDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status428PreconditionRequired)]
    public async Task<ActionResult<CurrentReadingDto>> GetPinnedStationCurrent(
        [FromQuery] string provider,
        [FromQuery] string sourceId,
        CancellationToken cancellationToken)
    {
        var result = await mediator
            .Send(new GetPinnedStationReadingQuery(provider, sourceId), cancellationToken)
            .ConfigureAwait(false);
        return Ok(result);
    }

    /// <summary>
    /// Returns the Ambient Weather stations contributing to neighbor comparison for an owned station.
    /// </summary>
    /// <response code="200">List of contributing neighbor stations.</response>
    /// <response code="401">Not authenticated.</response>
    [HttpGet("comparison-stations")]
    [ProducesResponseType<IReadOnlyList<NeighborStationDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<IReadOnlyList<NeighborStationDto>>> GetComparisonStations(
        [FromQuery] string? macAddress,
        CancellationToken cancellationToken)
    {
        var result = await mediator
            .Send(new GetNeighborComparisonStationsQuery(macAddress), cancellationToken)
            .ConfigureAwait(false);
        return Ok(result);
    }

    /// <summary>Triggers a neighbor station discovery refresh and returns the updated station list.</summary>
    [HttpPost("refresh")]
    [EnableRateLimiting("neighbor-refresh")]
    [ProducesResponseType<IReadOnlyList<NeighborStationDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status428PreconditionRequired)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<IReadOnlyList<NeighborStationDto>>> Refresh(
        CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new RefreshNeighborsCommand(), cancellationToken)
            .ConfigureAwait(false);
        return Ok(result);
    }
}
