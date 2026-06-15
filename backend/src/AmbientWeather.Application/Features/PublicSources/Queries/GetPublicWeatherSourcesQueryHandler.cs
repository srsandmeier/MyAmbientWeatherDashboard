using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.PublicSources;
using AmbientWeather.Application.Interfaces;
using MediatR;

namespace AmbientWeather.Application.Features.PublicSources.Queries;

/// <summary>
/// Handles <see cref="GetPublicWeatherSourcesQuery"/>.
/// </summary>
public sealed class GetPublicWeatherSourcesQueryHandler(
    IPublicWeatherSourceStore sourceStore,
    ICurrentUserService currentUserService)
    : IRequestHandler<GetPublicWeatherSourcesQuery, IReadOnlyList<PublicWeatherSourceDto>>
{
    /// <inheritdoc />
    public async Task<IReadOnlyList<PublicWeatherSourceDto>> Handle(
        GetPublicWeatherSourcesQuery request,
        CancellationToken cancellationToken)
    {
        var subject = currentUserService.RequireAuthenticatedUser();
        var sources = await sourceStore.GetAllAsync(subject, cancellationToken).ConfigureAwait(false);
        return sources.Select(PublicWeatherSourceDto.From).ToList();
    }
}
