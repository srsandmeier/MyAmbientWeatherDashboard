using System.Text.Json;
using AmbientWeather.Domain.Entities;

namespace AmbientWeather.Application.DTOs.Settings;

/// <summary>
/// Represents a user-owned Ambient Weather station with its user-defined settings.
/// Never contains Ambient API key material.
/// </summary>
public sealed record SettingsDeviceDto
{
    /// <summary>Gets the Ambient Weather MAC address.</summary>
    public required string MacAddress { get; init; }

    /// <summary>Gets the provider-assigned device name.</summary>
    public string? Name { get; init; }

    /// <summary>Gets the user-assigned nickname.</summary>
    public string? Nickname { get; init; }

    /// <summary>Gets a value indicating whether this is the user's primary/default station.</summary>
    public bool IsPrimary { get; init; }

    /// <summary>Gets a value indicating whether the station is shown on the dashboard.</summary>
    public bool DisplayOnDashboard { get; init; }

    /// <summary>Gets the metric keys selected for this station, or <see langword="null"/> when using defaults.</summary>
    public IReadOnlyList<string>? SelectedMetricKeys { get; init; }

    /// <summary>Gets the latitude in decimal degrees, or <see langword="null"/> when unavailable.</summary>
    public double? Latitude { get; init; }

    /// <summary>Gets the longitude in decimal degrees, or <see langword="null"/> when unavailable.</summary>
    public double? Longitude { get; init; }

    /// <summary>Gets the elevation in meters, or <see langword="null"/> when unavailable.</summary>
    public double? ElevationMeters { get; init; }

    /// <summary>Gets the formatted street address from the Ambient device location block, or <see langword="null"/> when unavailable.</summary>
    public string? Address { get; init; }

    /// <summary>Gets the city / locality label from the Ambient device location block, or <see langword="null"/> when unavailable.</summary>
    public string? Location { get; init; }

    /// <summary>Gets the UTC timestamp of the last metadata sync from Ambient, or <see langword="null"/> when never synced.</summary>
    public DateTime? LastSyncAtUtc { get; init; }

    /// <summary>
    /// Gets the IANA timezone identifier for this station (e.g. <c>America/Chicago</c>),
    /// sourced from the Ambient Weather <c>lastData.tz</c> field during sync.
    /// <see langword="null"/> until the first sync that returns a timezone value.
    /// </summary>
    public string? Tz { get; init; }

    /// <summary>Maps a <see cref="WeatherStation"/> entity to a <see cref="SettingsDeviceDto"/>.</summary>
    public static SettingsDeviceDto From(WeatherStation station) => new()
    {
        MacAddress = station.MacAddress,
        Name = station.Name,
        Nickname = station.Nickname,
        IsPrimary = station.IsPrimary,
        DisplayOnDashboard = station.DisplayOnDashboard,
        SelectedMetricKeys = DeserializeKeys(station.SelectedMetricKeysJson),
        Latitude = station.Latitude,
        Longitude = station.Longitude,
        ElevationMeters = station.ElevationMeters,
        Address = station.Address,
        Location = station.Location,
        LastSyncAtUtc = station.LastSyncAtUtc,
        Tz = station.Tz,
    };

    private static List<string>? DeserializeKeys(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<List<string>>(json);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
