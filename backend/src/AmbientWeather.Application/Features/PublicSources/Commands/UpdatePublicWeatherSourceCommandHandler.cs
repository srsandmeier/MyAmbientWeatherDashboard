using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.PublicSources;
using AmbientWeather.Application.Interfaces;
using MediatR;
using System.Text.Json;

namespace AmbientWeather.Application.Features.PublicSources.Commands;

/// <summary>
/// Handles <see cref="UpdatePublicWeatherSourceCommand"/>.
/// </summary>
public sealed class UpdatePublicWeatherSourceCommandHandler(
    IPublicWeatherSourceStore sourceStore,
    ICurrentUserService currentUserService)
    : IRequestHandler<UpdatePublicWeatherSourceCommand, PublicWeatherSourceDto>
{
    /// <inheritdoc />
    public async Task<PublicWeatherSourceDto> Handle(
        UpdatePublicWeatherSourceCommand request,
        CancellationToken cancellationToken)
    {
        var subject = currentUserService.RequireAuthenticatedUser();
        var source = await sourceStore.GetByIdAsync(subject, request.Id, cancellationToken).ConfigureAwait(false)
            ?? throw new AmbientApiNotFoundException();

        if (request.DisplayLabel is not null)
        {
            source.DisplayLabel = request.DisplayLabel;
        }

        if (request.IsEnabled.HasValue)
        {
            source.IsEnabled = request.IsEnabled.Value;
        }

        if (request.SelectedMetricKeys is not null)
        {
            source.SelectedMetricKeysJson = JsonSerializer.Serialize(request.SelectedMetricKeys);
        }

        source.UpdatedAtUtc = DateTime.UtcNow;
        await sourceStore.SaveAsync(source, cancellationToken).ConfigureAwait(false);

        return PublicWeatherSourceDto.From(source);
    }
}
