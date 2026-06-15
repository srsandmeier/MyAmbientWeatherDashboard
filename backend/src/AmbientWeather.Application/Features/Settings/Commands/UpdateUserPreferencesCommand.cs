using AmbientWeather.Application.DTOs.Settings;
using MediatR;

namespace AmbientWeather.Application.Features.Settings.Commands;

/// <summary>
/// Updates the display preferences for the authenticated user.
/// </summary>
/// <param name="TemperatureUnit">Temperature unit: <c>F</c> or <c>C</c>.</param>
/// <param name="SpeedUnit">Wind speed unit: <c>mph</c>, <c>kmh</c>, or <c>ms</c>.</param>
/// <param name="PressureUnit">Pressure unit: <c>inhg</c>, <c>hpa</c>, or <c>mbar</c>.</param>
/// <param name="RainfallUnit">Rainfall unit: <c>in</c> or <c>mm</c>.</param>
/// <param name="DistanceUnit">Distance unit: <c>mi</c> or <c>km</c>.</param>
/// <param name="Theme">UI theme: <c>light</c>, <c>dark</c>, or <c>system</c>.</param>
/// <param name="DateFormat">Date format: <c>mdy</c>, <c>dmy</c>, or <c>iso</c>.</param>
/// <param name="TemperatureDecimals">Decimal places for temperature display: 0, 1, or 2.</param>
/// <param name="DailyExtremaTimezone">Calendar-day timezone for daily high/low and history date queries: <c>utc</c> or <c>local</c>.</param>
public sealed record UpdateUserPreferencesCommand(
    string TemperatureUnit,
    string SpeedUnit,
    string PressureUnit,
    string RainfallUnit,
    string DistanceUnit,
    string Theme,
    string DateFormat,
    int TemperatureDecimals,
    string DailyExtremaTimezone) : IRequest<UserPreferencesDto>;
