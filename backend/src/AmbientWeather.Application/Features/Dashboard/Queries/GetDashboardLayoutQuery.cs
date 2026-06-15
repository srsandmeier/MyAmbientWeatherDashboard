using AmbientWeather.Application.DTOs.Dashboard;
using MediatR;

namespace AmbientWeather.Application.Features.Dashboard.Queries;

/// <summary>
/// Returns the user's active dashboard layout, seeding a suggested default on first access.
/// </summary>
public sealed record GetDashboardLayoutQuery : IRequest<DashboardLayoutDto>;
