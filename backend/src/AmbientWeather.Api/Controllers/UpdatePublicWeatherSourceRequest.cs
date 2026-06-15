namespace AmbientWeather.Api.Controllers;

/// <summary>
/// Request body for updating a user-selected public weather source.
/// </summary>
/// <param name="DisplayLabel">Optional replacement display label.</param>
/// <param name="IsEnabled">Optional enabled-state replacement.</param>
/// <param name="SelectedMetricKeys">Optional selected metric keys replacement.</param>
public sealed record UpdatePublicWeatherSourceRequest(
    string? DisplayLabel,
    bool? IsEnabled,
    IReadOnlyList<string>? SelectedMetricKeys);
