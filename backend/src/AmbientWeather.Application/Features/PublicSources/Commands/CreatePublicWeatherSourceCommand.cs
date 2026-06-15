using AmbientWeather.Application.DTOs.PublicSources;
using MediatR;

namespace AmbientWeather.Application.Features.PublicSources.Commands;

/// <summary>
/// Creates a public weather source selected by the authenticated user.
/// </summary>
public sealed record CreatePublicWeatherSourceCommand(
    string Provider,
    string SourceId,
    string DisplayLabel,
    double Latitude,
    double Longitude,
    string? Timezone,
    bool IsEnabled,
    IReadOnlyList<string>? SelectedMetricKeys = null) : IRequest<PublicWeatherSourceDto>;
