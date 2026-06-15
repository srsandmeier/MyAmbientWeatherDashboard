using AmbientWeather.Application.DTOs.Realtime;
using MediatR;

namespace AmbientWeather.Application.Features.Neighbors.Queries;

/// <summary>
/// Returns the most recently cached observation for a specific pinned neighbor station,
/// mapped to a <see cref="CurrentReadingDto"/> so it can be rendered in the same tile
/// components as owned-station data.
/// </summary>
/// <param name="Provider">Provider name: <c>AmbientOpen</c>, <c>WeatherGov</c>, or <c>OpenMeteo</c>.</param>
/// <param name="SourceId">Provider-assigned station identifier (MAC, NWS station ID, etc.).</param>
public sealed record GetPinnedStationReadingQuery(string Provider, string SourceId)
    : IRequest<CurrentReadingDto>;
