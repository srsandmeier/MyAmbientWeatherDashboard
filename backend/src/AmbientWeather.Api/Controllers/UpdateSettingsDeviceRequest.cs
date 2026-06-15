namespace AmbientWeather.Api.Controllers;

/// <summary>
/// Request body for <c>PUT /api/settings/devices/{mac}</c>.
/// All fields use patch semantics: null means "leave unchanged".
/// </summary>
public sealed class UpdateSettingsDeviceRequest
{
    /// <summary>Gets or sets the user-assigned nickname. Pass empty string to clear.</summary>
    public string? Nickname { get; set; }

    /// <summary>Gets or sets whether this is the primary/default station. Null leaves unchanged.</summary>
    public bool? IsPrimary { get; set; }

    /// <summary>Gets or sets whether the station is shown on the dashboard. Null leaves unchanged.</summary>
    public bool? DisplayOnDashboard { get; set; }

    /// <summary>Gets or sets the selected metric keys. Pass empty list to clear. Null leaves unchanged.</summary>
    public IReadOnlyList<string>? SelectedMetricKeys { get; set; }
}
