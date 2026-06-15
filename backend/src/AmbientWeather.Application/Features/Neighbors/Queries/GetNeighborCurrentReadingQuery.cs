using AmbientWeather.Application.DTOs.Realtime;
using MediatR;

namespace AmbientWeather.Application.Features.Neighbors.Queries;

/// <summary>
/// Returns an aggregated current reading from nearby public stations for the authenticated
/// user's primary station area. Throws <see cref="AmbientWeather.Application.Common.NeighborsUnavailableException"/>
/// when the feature is disabled, coordinates are missing, or no stations were discovered.
/// </summary>
public sealed record GetNeighborCurrentReadingQuery : IRequest<CurrentReadingDto>;
