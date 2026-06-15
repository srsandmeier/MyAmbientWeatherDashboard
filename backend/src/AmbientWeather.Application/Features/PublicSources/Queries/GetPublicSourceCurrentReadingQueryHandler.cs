using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.Realtime;
using AmbientWeather.Application.Interfaces;
using MediatR;

namespace AmbientWeather.Application.Features.PublicSources.Queries;

/// <summary>
/// Handles <see cref="GetPublicSourceCurrentReadingQuery"/>.
/// </summary>
public sealed class GetPublicSourceCurrentReadingQueryHandler(
    ICurrentUserService currentUserService,
    IPublicWeatherSourceStore sourceStore,
    IPublicSourceCurrentReadingService currentReadingService)
    : IRequestHandler<GetPublicSourceCurrentReadingQuery, CurrentReadingDto>
{
    /// <inheritdoc />
    public async Task<CurrentReadingDto> Handle(
        GetPublicSourceCurrentReadingQuery request,
        CancellationToken cancellationToken)
    {
        var subject = currentUserService.RequireAuthenticatedUser();
        var source = await sourceStore.GetByIdAsync(subject, request.Id, cancellationToken).ConfigureAwait(false)
            ?? throw new AmbientApiNotFoundException();

        var userHash = UserSegmentHash.Compute(subject);
        return await currentReadingService.GetCurrentAsync(userHash, source, cancellationToken).ConfigureAwait(false);
    }
}
