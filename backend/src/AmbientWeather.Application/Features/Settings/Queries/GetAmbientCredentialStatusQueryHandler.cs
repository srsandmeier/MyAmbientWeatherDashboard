using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.Settings;
using AmbientWeather.Application.Interfaces;
using MediatR;

namespace AmbientWeather.Application.Features.Settings.Queries;

/// <summary>
/// Handles <see cref="GetAmbientCredentialStatusQuery"/>.
/// </summary>
public sealed class GetAmbientCredentialStatusQueryHandler(
    IAmbientCredentialStore credentialStore,
    ICurrentUserService currentUserService) : IRequestHandler<GetAmbientCredentialStatusQuery, AmbientCredentialStatusDto>
{
    /// <inheritdoc />
    public async Task<AmbientCredentialStatusDto> Handle(
        GetAmbientCredentialStatusQuery request,
        CancellationToken cancellationToken)
    {
        var authProviderSubject = currentUserService.RequireAuthenticatedUser();
        var credentials = await credentialStore.GetAsync(authProviderSubject, cancellationToken).ConfigureAwait(false);

        return new AmbientCredentialStatusDto { HasCredentials = credentials != null };
    }
}
