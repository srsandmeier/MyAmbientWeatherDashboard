using AmbientWeather.Application.DTOs.PublicSources;
using MediatR;

namespace AmbientWeather.Application.Features.PublicSources.Queries;

/// <summary>
/// Query for all public weather sources selected by the authenticated user.
/// </summary>
public sealed record GetPublicWeatherSourcesQuery : IRequest<IReadOnlyList<PublicWeatherSourceDto>>;
