using AmbientWeather.Application.DTOs.Settings;
using MediatR;

namespace AmbientWeather.Application.Features.Settings.Queries;

/// <summary>
/// Returns all weather stations owned by the authenticated user.
/// </summary>
public sealed record GetSettingsDevicesQuery : IRequest<IReadOnlyList<SettingsDeviceDto>>;
