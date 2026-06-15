using AmbientWeather.Application.DTOs.Realtime;
using MediatR;

namespace AmbientWeather.Application.Features.Dashboard.Queries;

/// <summary>
/// Query to fetch the latest current reading for the user's default weather station.
/// Attempts to read from the latest-reading cache first; falls back to the Ambient
/// REST API if the cache is empty or stale.
/// </summary>
public sealed record GetCurrentReadingQuery : IRequest<CurrentReadingDto>;
