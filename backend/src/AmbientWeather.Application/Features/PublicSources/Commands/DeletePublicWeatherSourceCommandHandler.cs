using AmbientWeather.Application.Common;
using AmbientWeather.Application.Interfaces;
using MediatR;

namespace AmbientWeather.Application.Features.PublicSources.Commands;

/// <summary>
/// Handles <see cref="DeletePublicWeatherSourceCommand"/>.
/// </summary>
public sealed class DeletePublicWeatherSourceCommandHandler(
    IPublicWeatherSourceStore sourceStore,
    ICurrentUserService currentUserService) : IRequestHandler<DeletePublicWeatherSourceCommand>
{
    /// <inheritdoc />
    public async Task Handle(DeletePublicWeatherSourceCommand request, CancellationToken cancellationToken)
    {
        var subject = currentUserService.RequireAuthenticatedUser();
        var source = await sourceStore.GetByIdAsync(subject, request.Id, cancellationToken).ConfigureAwait(false)
            ?? throw new AmbientApiNotFoundException();

        await sourceStore.DeleteAsync(source, cancellationToken).ConfigureAwait(false);
    }
}
