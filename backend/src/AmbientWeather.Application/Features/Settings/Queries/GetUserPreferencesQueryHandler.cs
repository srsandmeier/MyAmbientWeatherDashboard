using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.Settings;
using AmbientWeather.Application.Interfaces;
using MediatR;

namespace AmbientWeather.Application.Features.Settings.Queries;

/// <summary>
/// Handles <see cref="GetUserPreferencesQuery"/>.
/// </summary>
public sealed class GetUserPreferencesQueryHandler(
    IUserPreferencesStore preferencesStore,
    ICurrentUserService currentUserService) : IRequestHandler<GetUserPreferencesQuery, UserPreferencesDto>
{
    /// <inheritdoc />
    public async Task<UserPreferencesDto> Handle(
        GetUserPreferencesQuery request,
        CancellationToken cancellationToken)
    {
        var subject = currentUserService.RequireAuthenticatedUser();
        var prefs = await preferencesStore
            .GetOrCreateAsync(subject, currentUserService.Email, cancellationToken)
            .ConfigureAwait(false);

        return UserPreferencesDto.From(prefs);
    }
}
