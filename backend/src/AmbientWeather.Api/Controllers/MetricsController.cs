using AmbientWeather.Application.DTOs.Common;
using AmbientWeather.Application.DTOs.Metrics;
using AmbientWeather.Application.Features.Metrics.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AmbientWeather.Api.Controllers;

/// <summary>
/// BFF endpoints for metric history data.
/// </summary>
[ApiController]
[Route("api/metrics")]
[Produces("application/json")]
[Authorize(Policy = "AuthenticatedUser")]
[EnableRateLimiting("per-user")]
public class MetricsController(IMediator mediator) : ControllerBase
{
    /// <summary>
    /// Returns chart-ready metric history for a single metric from an owned station.
    /// Pages Ambient Weather history, caches individual pages in Redis, and aggregates to
    /// the requested granularity.
    /// </summary>
    /// <param name="metricKey">
    /// User-facing metric key (e.g., <c>outdoor_temp</c>, <c>wind_speed</c>, <c>rainfall_day</c>).
    /// </param>
    /// <param name="range">
    /// Preset time range or mode: <c>24h</c>, <c>7d</c>, <c>30d</c>, <c>90d</c>, <c>1y</c>, <c>custom</c>, <c>date</c>.
    /// </param>
    /// <param name="deviceId">
    /// Optional MAC address of an owned station. Omit to use the user's default station.
    /// </param>
    /// <param name="from">ISO date/time start for <c>range=custom</c>.</param>
    /// <param name="to">ISO date/time end for <c>range=custom</c>.</param>
    /// <param name="date">Calendar date in <c>YYYY-MM-DD</c> format for <c>range=date</c>.</param>
    /// <param name="granularity">
    /// Aggregation resolution: <c>auto</c> (default), <c>raw</c>, <c>hour</c>, or <c>day</c>.
    /// </param>
    /// <param name="source">Data source. Only <c>my</c> is accepted in this version.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <response code="200">History retrieved successfully.</response>
    /// <response code="400">Invalid metric key, range, or query parameters.</response>
    /// <response code="401">Authentication required.</response>
    /// <response code="404">Requested station not found or not owned by the authenticated user.</response>
    /// <response code="428">Ambient credentials or default station not configured.</response>
    /// <response code="429">Ambient API rate limit exceeded.</response>
    /// <response code="503">Ambient API unavailable (circuit breaker open).</response>
    [HttpGet("{metricKey}/history")]
    [EnableRateLimiting("metric-history")]
    [ProducesResponseType(typeof(MetricHistoryResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status428PreconditionRequired)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status429TooManyRequests)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<MetricHistoryResponseDto>> GetMetricHistory(
        [FromRoute] string metricKey,
        [FromQuery] string range = "24h",
        [FromQuery] string? deviceId = null,
        [FromQuery] string? from = null,
        [FromQuery] string? to = null,
        [FromQuery] string? date = null,
        [FromQuery] string? granularity = null,
        [FromQuery] string? source = null,
        CancellationToken cancellationToken = default)
    {
        var result = await mediator.Send(
            new GetMetricHistoryQuery(metricKey, range, deviceId, from, to, date, granularity, source),
            cancellationToken);

        return Ok(result);
    }
}
