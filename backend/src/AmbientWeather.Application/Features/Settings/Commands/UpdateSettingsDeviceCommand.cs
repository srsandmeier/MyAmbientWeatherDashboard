using MediatR;

namespace AmbientWeather.Application.Features.Settings.Commands;

/// <summary>
/// Updates user-managed fields on an owned weather station.
/// All optional fields use patch semantics: null means "leave unchanged".
/// </summary>
/// <param name="MacAddress">The station's MAC address (normalized or raw).</param>
/// <param name="Nickname">User-assigned nickname. Pass null to leave unchanged; pass empty string to clear.</param>
/// <param name="IsPrimary">When true, marks this as the primary station (clears others). Null leaves unchanged.</param>
/// <param name="DisplayOnDashboard">Dashboard visibility toggle. Null leaves unchanged.</param>
/// <param name="SelectedMetricKeys">Metric key selection. Pass null to leave unchanged; pass empty list to clear.</param>
public sealed record UpdateSettingsDeviceCommand(
    string MacAddress,
    string? Nickname,
    bool? IsPrimary,
    bool? DisplayOnDashboard,
    IReadOnlyList<string>? SelectedMetricKeys) : IRequest;
