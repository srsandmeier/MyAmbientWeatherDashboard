using AmbientWeather.Application.DTOs.Settings;
using MediatR;

namespace AmbientWeather.Application.Features.Settings.Commands;

/// <summary>
/// Syncs the authenticated user's Ambient Weather devices into the local station store.
/// Requires saved credentials. Preserves user-managed fields across syncs.
/// </summary>
public sealed record SyncSettingsDevicesCommand : IRequest<IReadOnlyList<SettingsDeviceDto>>;
