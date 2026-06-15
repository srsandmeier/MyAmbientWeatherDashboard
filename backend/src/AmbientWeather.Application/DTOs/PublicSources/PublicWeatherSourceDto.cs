using AmbientWeather.Domain.Entities;
using System.Text.Json;

namespace AmbientWeather.Application.DTOs.PublicSources;

/// <summary>
/// User-selected public weather source available to dashboard layouts.
/// </summary>
public sealed record PublicWeatherSourceDto
{
    /// <summary>Source identifier.</summary>
    public Guid Id { get; init; }

    /// <summary>Public provider key.</summary>
    public required string Provider { get; init; }

    /// <summary>Provider-specific source identifier.</summary>
    public required string SourceId { get; init; }

    /// <summary>User-facing display label.</summary>
    public required string DisplayLabel { get; init; }

    /// <summary>Selected source latitude.</summary>
    public double Latitude { get; init; }

    /// <summary>Selected source longitude.</summary>
    public double Longitude { get; init; }

    /// <summary>Optional IANA timezone.</summary>
    public string? Timezone { get; init; }

    /// <summary>Whether this source is enabled for dashboard layouts.</summary>
    public bool IsEnabled { get; init; }

    /// <summary>
    /// Selected metric keys for this source. <see langword="null"/> means all provider-supported metrics.
    /// </summary>
    public IReadOnlyList<string>? SelectedMetricKeys { get; init; }

    /// <summary>UTC timestamp when the source was created.</summary>
    public DateTime CreatedAtUtc { get; init; }

    /// <summary>UTC timestamp when the source was last updated.</summary>
    public DateTime UpdatedAtUtc { get; init; }

    /// <summary>
    /// Creates a DTO from a persisted source entity.
    /// </summary>
    public static PublicWeatherSourceDto From(PublicWeatherSource source) => new()
    {
        Id = source.Id,
        Provider = source.Provider,
        SourceId = source.SourceId,
        DisplayLabel = source.DisplayLabel,
        Latitude = source.Latitude,
        Longitude = source.Longitude,
        Timezone = source.Timezone,
        IsEnabled = source.IsEnabled,
        SelectedMetricKeys = DeserializeKeys(source.SelectedMetricKeysJson),
        CreatedAtUtc = source.CreatedAtUtc,
        UpdatedAtUtc = source.UpdatedAtUtc,
    };

    private static IReadOnlyList<string>? DeserializeKeys(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<IReadOnlyList<string>>(json);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
