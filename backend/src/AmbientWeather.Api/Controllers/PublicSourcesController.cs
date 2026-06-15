using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.Common;
using AmbientWeather.Application.DTOs.PublicSources;
using AmbientWeather.Application.DTOs.Realtime;
using AmbientWeather.Application.Features.PublicSources.Commands;
using AmbientWeather.Application.Features.PublicSources.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AmbientWeather.Api.Controllers;

/// <summary>
/// API endpoints for authenticated users to manage public weather sources.
/// </summary>
[ApiController]
[Route("api/public-sources")]
[Produces("application/json")]
[Authorize(Policy = "AuthenticatedUser")]
[EnableRateLimiting("per-user")]
public sealed class PublicSourcesController(IMediator mediator) : ControllerBase
{
    /// <summary>
    /// Searches for discoverable public weather sources near the given location.
    /// </summary>
    /// <param name="q">Zipcode or "City, State" query string (max 128 chars).</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>List of candidate sources (may be empty if no results found).</returns>
    [HttpGet("discover")]
    [ProducesResponseType(typeof(IReadOnlyList<DiscoveredPublicSourceDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<IReadOnlyList<DiscoveredPublicSourceDto>>> Discover(
        [FromQuery] string? q,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Length > 128)
            return BadRequest(new ErrorResponseDto
            {
                Error = "invalid-query",
                Message = "Query must be between 1 and 128 characters.",
                StatusCode = StatusCodes.Status400BadRequest,
            });

        var result = await mediator.Send(new DiscoverPublicSourcesQuery(q.Trim()), cancellationToken).ConfigureAwait(false);
        return Ok(result);
    }

    /// <summary>
    /// Returns all public weather sources selected by the authenticated user.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>The user's selected public weather sources.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<PublicWeatherSourceDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<PublicWeatherSourceDto>>> GetSources(
        CancellationToken cancellationToken = default)
    {
        var result = await mediator.Send(new GetPublicWeatherSourcesQuery(), cancellationToken).ConfigureAwait(false);
        return Ok(result);
    }

    /// <summary>
    /// Returns a current reading for a selected public weather source.
    /// </summary>
    /// <param name="id">The source identifier.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>The source's current reading.</returns>
    [HttpGet("{id:guid}/current")]
    [ProducesResponseType(typeof(CurrentReadingDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CurrentReadingDto>> GetSourceCurrent(
        [FromRoute] Guid id,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await mediator
                .Send(new GetPublicSourceCurrentReadingQuery(id), cancellationToken)
                .ConfigureAwait(false);
            return Ok(result);
        }
        catch (AmbientApiNotFoundException)
        {
            return NotFound(SourceNotFoundError());
        }
    }

    /// <summary>
    /// Adds a public weather source for the authenticated user.
    /// </summary>
    /// <param name="request">The source selection to save.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>The saved public weather source.</returns>
    [HttpPost]
    [ProducesResponseType(typeof(PublicWeatherSourceDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<PublicWeatherSourceDto>> CreateSource(
        [FromBody] CreatePublicWeatherSourceRequest request,
        CancellationToken cancellationToken = default)
    {
        var result = await mediator.Send(
            new CreatePublicWeatherSourceCommand(
                request.Provider,
                request.SourceId,
                request.DisplayLabel,
                request.Latitude,
                request.Longitude,
                request.Timezone,
                request.IsEnabled,
                request.SelectedMetricKeys),
            cancellationToken).ConfigureAwait(false);

        return CreatedAtAction(nameof(GetSources), result);
    }

    /// <summary>
    /// Updates user-managed settings for a selected public weather source.
    /// </summary>
    /// <param name="id">The source identifier.</param>
    /// <param name="request">Patch-style source settings.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>The saved public weather source.</returns>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(PublicWeatherSourceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PublicWeatherSourceDto>> UpdateSource(
        [FromRoute] Guid id,
        [FromBody] UpdatePublicWeatherSourceRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await mediator.Send(
                new UpdatePublicWeatherSourceCommand(id, request.DisplayLabel, request.IsEnabled, request.SelectedMetricKeys),
                cancellationToken).ConfigureAwait(false);

            return Ok(result);
        }
        catch (AmbientApiNotFoundException)
        {
            return NotFound(SourceNotFoundError());
        }
    }

    /// <summary>
    /// Deletes a selected public weather source for the authenticated user.
    /// </summary>
    /// <param name="id">The source identifier.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>No content when the source is deleted.</returns>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status404NotFound)]
    public async Task<ActionResult> DeleteSource(
        [FromRoute] Guid id,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await mediator.Send(new DeletePublicWeatherSourceCommand(id), cancellationToken).ConfigureAwait(false);
            return NoContent();
        }
        catch (AmbientApiNotFoundException)
        {
            return NotFound(SourceNotFoundError());
        }
    }

    private static ErrorResponseDto SourceNotFoundError() => new()
    {
        Error = "public-source-not-found",
        Message = "No public weather source was found for your account.",
        StatusCode = StatusCodes.Status404NotFound,
    };
}
