using AmbientWeather.Application.DTOs.Neighbors;
using MediatR;

namespace AmbientWeather.Application.Features.Neighbors.Queries;

/// <summary>
/// Returns Ambient Weather stations used for neighbor comparison around an owned station.
/// </summary>
/// <param name="MacAddress">Optional owned station MAC address. When absent, the default station is used.</param>
public sealed record GetNeighborComparisonStationsQuery(string? MacAddress) : IRequest<IReadOnlyList<NeighborStationDto>>;
