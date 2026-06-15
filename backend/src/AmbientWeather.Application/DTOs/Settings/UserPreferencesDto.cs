using AmbientWeather.Domain.Entities;

namespace AmbientWeather.Application.DTOs.Settings;

/// <summary>
/// User-configurable display preferences returned by <c>GET /api/settings/preferences</c>.
/// </summary>
public sealed record UserPreferencesDto
{
    /// <summary>Gets the temperature unit: <c>F</c> or <c>C</c>.</summary>
    public required string TemperatureUnit { get; init; }

    /// <summary>Gets the wind speed unit: <c>mph</c>, <c>kmh</c>, or <c>ms</c>.</summary>
    public required string SpeedUnit { get; init; }

    /// <summary>Gets the pressure unit: <c>inhg</c>, <c>hpa</c>, or <c>mbar</c>.</summary>
    public required string PressureUnit { get; init; }

    /// <summary>Gets the rainfall unit: <c>in</c> or <c>mm</c>.</summary>
    public required string RainfallUnit { get; init; }

    /// <summary>Gets the distance unit: <c>mi</c> or <c>km</c>.</summary>
    public required string DistanceUnit { get; init; }

    /// <summary>Gets the UI theme: <c>light</c>, <c>dark</c>, or <c>system</c>.</summary>
    public required string Theme { get; init; }

    /// <summary>Gets the date format: <c>mdy</c>, <c>dmy</c>, or <c>iso</c>.</summary>
    public required string DateFormat { get; init; }

    /// <summary>Gets the number of decimal places to show for temperature values: 0, 1, or 2.</summary>
    public required int TemperatureDecimals { get; init; }

    /// <summary>
    /// Gets the calendar-day timezone for daily aggregate metrics and history date queries:
    /// <c>utc</c> or <c>local</c>.
    /// </summary>
    public required string DailyExtremaTimezone { get; init; }

    /// <summary>
    /// Maps a <see cref="UserPreferences"/> entity to a <see cref="UserPreferencesDto"/>.
    /// Centralises the mapping so adding a new preference field only requires one update.
    /// </summary>
    public static UserPreferencesDto From(UserPreferences prefs) => new()
    {
        TemperatureUnit = prefs.TemperatureUnit,
        SpeedUnit = prefs.SpeedUnit,
        PressureUnit = prefs.PressureUnit,
        RainfallUnit = prefs.RainfallUnit,
        DistanceUnit = prefs.DistanceUnit,
        Theme = prefs.Theme,
        DateFormat = prefs.DateFormat,
        TemperatureDecimals = prefs.TemperatureDecimals,
        DailyExtremaTimezone = prefs.DailyExtremaTimezone,
    };
}
