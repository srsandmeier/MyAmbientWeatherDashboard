namespace AmbientWeather.Application.DTOs.PublicSources;

/// <summary>
/// A candidate public weather source returned by the discovery search.
/// </summary>
public sealed record DiscoveredPublicSourceDto
{
    /// <summary>The provider name (e.g. "WeatherGov", "OpenMeteo").</summary>
    public required string Provider { get; init; }

    /// <summary>The external station identifier used when saving the source.</summary>
    public required string SourceId { get; init; }

    /// <summary>Human-readable station name or description.</summary>
    public required string DisplayLabel { get; init; }

    /// <summary>Geocoded latitude.</summary>
    public double Latitude { get; init; }

    /// <summary>Geocoded longitude.</summary>
    public double Longitude { get; init; }

    /// <summary>IANA timezone for the location, when available.</summary>
    public string? Timezone { get; init; }
}
