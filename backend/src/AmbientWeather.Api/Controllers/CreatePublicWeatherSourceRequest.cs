namespace AmbientWeather.Api.Controllers;

/// <summary>
/// Request body for creating a user-selected public weather source.
/// </summary>
/// <param name="Provider">Public provider key.</param>
/// <param name="SourceId">Provider-specific source identifier.</param>
/// <param name="DisplayLabel">User-facing display label.</param>
/// <param name="Latitude">Selected source latitude.</param>
/// <param name="Longitude">Selected source longitude.</param>
/// <param name="Timezone">Optional IANA timezone.</param>
/// <param name="IsEnabled">Whether this source is enabled for dashboard layouts.</param>
/// <param name="SelectedMetricKeys">Optional selected metric keys; null means all provider-supported metrics.</param>
public sealed record CreatePublicWeatherSourceRequest(
    string Provider,
    string SourceId,
    string DisplayLabel,
    double Latitude,
    double Longitude,
    string? Timezone,
    bool IsEnabled = true,
    IReadOnlyList<string>? SelectedMetricKeys = null);
