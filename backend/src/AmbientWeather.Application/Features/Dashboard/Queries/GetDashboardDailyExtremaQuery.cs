using AmbientWeather.Application.DTOs.Dashboard;
using MediatR;

namespace AmbientWeather.Application.Features.Dashboard.Queries;

/// <summary>
/// Returns the daily high/low outdoor and indoor temperatures for the user's default station,
/// computed from stored readings for the current UTC calendar day.
/// </summary>
public sealed record GetDashboardDailyExtremaQuery : IRequest<DailyExtremaDto>;
