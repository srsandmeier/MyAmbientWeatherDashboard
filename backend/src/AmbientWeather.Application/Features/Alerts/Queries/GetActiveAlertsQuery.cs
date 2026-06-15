using AmbientWeather.Application.DTOs.Alerts;
using MediatR;

namespace AmbientWeather.Application.Features.Alerts.Queries;

/// <summary>
/// Query for active public weather alerts near the authenticated user's default station or selected area.
/// </summary>
/// <param name="AreaCode">Optional Weather.gov area, zone, or state code.</param>
public sealed record GetActiveAlertsQuery(string? AreaCode = null) : IRequest<IReadOnlyList<WeatherAlertDto>>;
