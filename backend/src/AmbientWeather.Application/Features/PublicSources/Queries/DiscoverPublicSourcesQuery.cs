using AmbientWeather.Application.DTOs.PublicSources;
using MediatR;

namespace AmbientWeather.Application.Features.PublicSources.Queries;

/// <summary>
/// Returns a list of discoverable public weather sources for a given location query.
/// </summary>
/// <param name="SearchQuery">Zipcode or city/state string (e.g. "{zip}" or "{city}, {state}").</param>
public sealed record DiscoverPublicSourcesQuery(string SearchQuery) : IRequest<IReadOnlyList<DiscoveredPublicSourceDto>>;
