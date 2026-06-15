using AmbientWeather.Application.DTOs.Settings;
using MediatR;

namespace AmbientWeather.Application.Features.Settings.Queries;

/// <summary>
/// Returns the display preferences for the authenticated user, creating defaults on first use.
/// </summary>
public sealed record GetUserPreferencesQuery : IRequest<UserPreferencesDto>;
