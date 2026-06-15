using AmbientWeather.Application.DTOs.PublicSources;
using MediatR;

namespace AmbientWeather.Application.Features.PublicSources.Commands;

/// <summary>
/// Updates a public weather source selected by the authenticated user.
/// </summary>
public sealed record UpdatePublicWeatherSourceCommand(
    Guid Id,
    string? DisplayLabel,
    bool? IsEnabled,
    IReadOnlyList<string>? SelectedMetricKeys = null) : IRequest<PublicWeatherSourceDto>;
