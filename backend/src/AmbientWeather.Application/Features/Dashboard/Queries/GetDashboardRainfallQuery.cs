using AmbientWeather.Application.DTOs.Dashboard;
using MediatR;

namespace AmbientWeather.Application.Features.Dashboard.Queries;

/// <summary>
/// Returns a rainfall accumulation snapshot for the user's default weather station.
/// Reads from the latest-reading cache first; falls back to the Ambient REST API on cache miss.
/// </summary>
public sealed record GetDashboardRainfallQuery : IRequest<DashboardRainfallDto>;
