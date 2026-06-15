using AmbientWeather.Domain.Entities;

namespace AmbientWeather.Application.Features.Neighbors;

/// <summary>Shared location label utilities for neighbor handlers.</summary>
internal static class NeighborLocationHelper
{
    /// <summary>Returns a display label for the station's location.</summary>
    internal static string? GetStationLocationLabel(WeatherStation station) =>
        NormalizeLocationLabel(station.Location)
        ?? NormalizeLocationLabel(station.Address)
        ?? NormalizeLocationLabel(station.Nickname)
        ?? NormalizeLocationLabel(station.Name);

    /// <summary>Normalizes a location label string.</summary>
    internal static string? NormalizeLocationLabel(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
