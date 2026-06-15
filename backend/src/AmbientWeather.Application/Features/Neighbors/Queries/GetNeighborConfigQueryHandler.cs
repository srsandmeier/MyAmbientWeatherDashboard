using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.Neighbors;
using AmbientWeather.Application.Interfaces;
using MediatR;

namespace AmbientWeather.Application.Features.Neighbors.Queries;

/// <summary>
/// Handles <see cref="GetNeighborConfigQuery"/>.
/// </summary>
public sealed class GetNeighborConfigQueryHandler(
    IUserPreferencesStore preferencesStore,
    ICurrentUserService currentUserService) : IRequestHandler<GetNeighborConfigQuery, NeighborConfigDto>
{
    /// <inheritdoc />
    public async Task<NeighborConfigDto> Handle(
        GetNeighborConfigQuery request,
        CancellationToken cancellationToken)
    {
        var subject = currentUserService.RequireAuthenticatedUser();
        var prefs = await preferencesStore
            .GetOrCreateAsync(subject, currentUserService.Email, cancellationToken)
            .ConfigureAwait(false);

        var config = NeighborConfigJsonOptions.Deserialize(prefs.NeighborConfigJson);
        return NeighborConfigDto.From(config);
    }
}
