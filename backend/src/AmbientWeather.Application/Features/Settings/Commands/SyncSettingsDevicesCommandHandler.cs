using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.Settings;
using AmbientWeather.Application.Interfaces;
using MediatR;

namespace AmbientWeather.Application.Features.Settings.Commands;

/// <summary>
/// Handles <see cref="SyncSettingsDevicesCommand"/> by calling Ambient <c>GET /devices</c>
/// and upserting station rows for the authenticated user.
/// </summary>
public sealed class SyncSettingsDevicesCommandHandler(
    IAmbientRestClient ambientRestClient,
    IAmbientCredentialStore credentialStore,
    IUserStationStore stationStore,
    ICurrentUserService currentUserService,
    IRealtimeSubscriptionRegistry realtimeSubscriptionRegistry) : IRequestHandler<SyncSettingsDevicesCommand, IReadOnlyList<SettingsDeviceDto>>
{
    /// <inheritdoc />
    public async Task<IReadOnlyList<SettingsDeviceDto>> Handle(
        SyncSettingsDevicesCommand request,
        CancellationToken cancellationToken)
    {
        var subject = currentUserService.RequireAuthenticatedUser();

        var credentials = await credentialStore.GetAsync(subject, cancellationToken).ConfigureAwait(false)
            ?? throw new AmbientCredentialsRequiredException();

        var devices = await ambientRestClient.GetDevicesAsync(
            credentials.ApiKey,
            credentials.ApplicationKey,
            cancellationToken).ConfigureAwait(false);

        var stations = await stationStore.SyncStationsAsync(
            subject,
            currentUserService.Email,
            devices,
            cancellationToken).ConfigureAwait(false);

        await realtimeSubscriptionRegistry.InvalidateAsync(subject, cancellationToken)
            .ConfigureAwait(false);

        return stations.Select(SettingsDeviceDto.From).ToList();
    }
}
