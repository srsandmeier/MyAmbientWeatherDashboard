using AmbientWeather.Application.DTOs.Neighbors;
using MediatR;

namespace AmbientWeather.Application.Features.Neighbors.Commands;

/// <summary>
/// Clears the neighbor station cache for the authenticated user and triggers an immediate
/// re-discovery across all enabled providers. Returns the refreshed station list.
/// </summary>
public sealed record RefreshNeighborsCommand : IRequest<IReadOnlyList<NeighborStationDto>>;
