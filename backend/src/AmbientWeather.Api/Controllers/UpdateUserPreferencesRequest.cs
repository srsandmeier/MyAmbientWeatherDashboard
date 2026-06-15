namespace AmbientWeather.Api.Controllers;

/// <summary>
/// Request body for <c>PUT /api/settings/preferences</c>.
/// </summary>
public sealed record UpdateUserPreferencesRequest
{
    /// <summary>Gets the temperature unit: <c>F</c> or <c>C</c>.</summary>
    public string TemperatureUnit { get; init; } = "F";

    /// <summary>Gets the wind speed unit: <c>mph</c>, <c>kmh</c>, or <c>ms</c>.</summary>
    public string SpeedUnit { get; init; } = "mph";

    /// <summary>Gets the pressure unit: <c>inhg</c>, <c>hpa</c>, or <c>mbar</c>.</summary>
    public string PressureUnit { get; init; } = "inhg";

    /// <summary>Gets the rainfall unit: <c>in</c> or <c>mm</c>.</summary>
    public string RainfallUnit { get; init; } = "in";

    /// <summary>Gets the distance unit: <c>mi</c> or <c>km</c>.</summary>
    public string DistanceUnit { get; init; } = "mi";

    /// <summary>Gets the UI theme: <c>light</c>, <c>dark</c>, or <c>system</c>.</summary>
    public string Theme { get; init; } = "system";

    /// <summary>Gets the date format: <c>mdy</c>, <c>dmy</c>, or <c>iso</c>.</summary>
    public string DateFormat { get; init; } = "mdy";

    /// <summary>Gets the number of decimal places for temperature values: 0, 1, or 2.</summary>
    public int TemperatureDecimals { get; init; } = 1;

    /// <summary>Gets the calendar-day timezone for daily high/low and history date queries: <c>utc</c> or <c>local</c>.</summary>
    public string DailyExtremaTimezone { get; init; } = "local";
}
