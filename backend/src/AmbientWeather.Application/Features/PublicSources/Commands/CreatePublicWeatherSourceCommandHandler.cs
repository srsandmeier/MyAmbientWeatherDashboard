using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.PublicSources;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using MediatR;
using System.Text.Json;

namespace AmbientWeather.Application.Features.PublicSources.Commands;

/// <summary>
/// Handles <see cref="CreatePublicWeatherSourceCommand"/>.
/// </summary>
public sealed class CreatePublicWeatherSourceCommandHandler(
    IPublicWeatherSourceStore sourceStore,
    ICurrentUserService currentUserService)
    : IRequestHandler<CreatePublicWeatherSourceCommand, PublicWeatherSourceDto>
{
    /// <inheritdoc />
    public async Task<PublicWeatherSourceDto> Handle(
        CreatePublicWeatherSourceCommand request,
        CancellationToken cancellationToken)
    {
        var subject = currentUserService.RequireAuthenticatedUser();
        var now = DateTime.UtcNow;
        var source = new PublicWeatherSource
        {
            Provider = request.Provider,
            SourceId = request.SourceId,
            DisplayLabel = request.DisplayLabel,
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            Timezone = string.IsNullOrWhiteSpace(request.Timezone) ? null : request.Timezone,
            IsEnabled = request.IsEnabled,
            SelectedMetricKeysJson = request.SelectedMetricKeys is null
                ? null
                : JsonSerializer.Serialize(request.SelectedMetricKeys),
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        var saved = await sourceStore
            .AddAsync(subject, currentUserService.Email, source, cancellationToken)
            .ConfigureAwait(false);

        return PublicWeatherSourceDto.From(saved);
    }
}
