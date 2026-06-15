using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.PublicSources;
using AmbientWeather.Application.Interfaces;
using MediatR;

namespace AmbientWeather.Application.Features.PublicSources.Queries;

/// <summary>
/// Handles <see cref="DiscoverPublicSourcesQuery"/> by delegating geocoding and station lookup
/// to <see cref="IPublicSourceDiscoveryService"/>.
/// </summary>
public sealed class DiscoverPublicSourcesQueryHandler(
    IPublicSourceDiscoveryService discoveryService,
    ICurrentUserService currentUserService)
    : IRequestHandler<DiscoverPublicSourcesQuery, IReadOnlyList<DiscoveredPublicSourceDto>>
{
    /// <inheritdoc/>
    public Task<IReadOnlyList<DiscoveredPublicSourceDto>> Handle(
        DiscoverPublicSourcesQuery request,
        CancellationToken cancellationToken)
    {
        currentUserService.RequireAuthenticatedUser();
        return discoveryService.DiscoverAsync(request.SearchQuery, cancellationToken);
    }
}
