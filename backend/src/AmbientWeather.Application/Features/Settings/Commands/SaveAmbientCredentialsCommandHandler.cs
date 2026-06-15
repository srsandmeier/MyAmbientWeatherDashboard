using AmbientWeather.Application.Common;
using AmbientWeather.Application.Interfaces;
using MediatR;
using Microsoft.Extensions.Logging;

namespace AmbientWeather.Application.Features.Settings.Commands;

/// <summary>
/// Handles <see cref="SaveAmbientCredentialsCommand"/> by validating and storing Ambient credentials,
/// then syncing the user's device list so station rows are populated immediately.
/// </summary>
public sealed partial class SaveAmbientCredentialsCommandHandler(
    IAmbientRestClient ambientRestClient,
    IAmbientCredentialStore credentialStore,
    IUserStationStore stationStore,
    ICurrentUserService currentUserService,
    IRealtimeSubscriptionRegistry realtimeSubscriptionRegistry,
    ILogger<SaveAmbientCredentialsCommandHandler> logger) : IRequestHandler<SaveAmbientCredentialsCommand>
{
    /// <inheritdoc />
    public async Task Handle(SaveAmbientCredentialsCommand request, CancellationToken cancellationToken)
    {
        var authProviderSubject = currentUserService.RequireAuthenticatedUser();

        // Validate credentials and capture the device list in the same call.
        var devices = await ambientRestClient.GetDevicesAsync(
            request.ApiKey,
            request.ApplicationKey,
            cancellationToken).ConfigureAwait(false);

        await credentialStore.SaveAsync(
            authProviderSubject,
            currentUserService.Email,
            request.ApiKey,
            request.ApplicationKey,
            cancellationToken).ConfigureAwait(false);

        // Sync station rows using the already-fetched device list; no extra Ambient call needed.
        // Credentials are committed above and valid; a transient DB failure here is recoverable
        // via POST /api/settings/devices/sync without re-entering credentials.
        try
        {
            await stationStore.SyncStationsAsync(
                authProviderSubject,
                currentUserService.Email,
                devices,
                cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogStationSyncFailed(logger, ex);
        }

        await realtimeSubscriptionRegistry
            .InvalidateAsync(authProviderSubject, cancellationToken)
            .ConfigureAwait(false);
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Station auto-sync failed after credential save; the user can trigger a manual sync.")]
    private static partial void LogStationSyncFailed(ILogger logger, Exception exception);
}
