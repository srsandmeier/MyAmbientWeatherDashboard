using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.Settings;
using AmbientWeather.Application.Interfaces;
using MediatR;

namespace AmbientWeather.Application.Features.Settings.Queries;

/// <summary>
/// Handles <see cref="GetSettingsDevicesQuery"/> by returning owned stations for the authenticated user.
/// </summary>
public sealed class GetSettingsDevicesQueryHandler(
    IUserStationStore stationStore,
    ICurrentUserService currentUserService) : IRequestHandler<GetSettingsDevicesQuery, IReadOnlyList<SettingsDeviceDto>>
{
    /// <inheritdoc />
    public async Task<IReadOnlyList<SettingsDeviceDto>> Handle(
        GetSettingsDevicesQuery request,
        CancellationToken cancellationToken)
    {
        var subject = currentUserService.RequireAuthenticatedUser();
        var stations = await stationStore.GetOwnedStationsAsync(subject, cancellationToken).ConfigureAwait(false);
        return stations.Select(SettingsDeviceDto.From).ToList();
    }
}
