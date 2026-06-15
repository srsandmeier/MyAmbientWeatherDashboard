using AmbientWeather.Application.DTOs.Neighbors;
using MediatR;

namespace AmbientWeather.Application.Features.Neighbors.Queries;

/// <summary>
/// Returns the neighbor comparison configuration for the authenticated user, seeding
/// defaults on first access.
/// </summary>
public sealed record GetNeighborConfigQuery : IRequest<NeighborConfigDto>;
