using AmbientWeather.Application.Common;
using AmbientWeather.Application.Interfaces;
using MediatR;

namespace AmbientWeather.Application.Features.Settings.Commands;

/// <summary>
/// Handles <see cref="DeleteAmbientCredentialsCommand"/>.
/// Deletes stored credentials then invalidates the user's history cache so that
/// subsequent requests do not serve stale cached history after credentials are gone.
/// </summary>
public sealed class DeleteAmbientCredentialsCommandHandler(
    IAmbientCredentialStore credentialStore,
    IDeviceHistoryService deviceHistoryService,
    ICurrentUserService currentUserService,
    IRealtimeSubscriptionRegistry realtimeSubscriptionRegistry) : IRequestHandler<DeleteAmbientCredentialsCommand>
{
    /// <inheritdoc />
    public async Task Handle(DeleteAmbientCredentialsCommand request, CancellationToken cancellationToken)
    {
        var authProviderSubject = currentUserService.RequireAuthenticatedUser();
        await credentialStore.DeleteAsync(authProviderSubject, cancellationToken).ConfigureAwait(false);
        await deviceHistoryService.InvalidateAllCachesAsync(cancellationToken).ConfigureAwait(false);
        await realtimeSubscriptionRegistry.InvalidateAsync(authProviderSubject, cancellationToken)
            .ConfigureAwait(false);
    }
}
