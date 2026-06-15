namespace AmbientWeather.Domain.Entities;

/// <summary>
/// Ambient Weather station metadata owned by a user or cached for neighbour comparisons.
/// </summary>
public sealed class WeatherStation
{
    /// <summary>
    /// Station identifier.
    /// </summary>
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Owning user. Null for globally cached public neighbour stations.
    /// </summary>
    public Guid? UserId { get; set; }

    /// <summary>
    /// Ambient Weather MAC address.
    /// </summary>
    public required string MacAddress { get; set; }

    /// <summary>
    /// Station name returned by Ambient Weather.
    /// </summary>
    public string? Name { get; set; }

    /// <summary>
    /// User-provided nickname.
    /// </summary>
    public string? Nickname { get; set; }

    /// <summary>
    /// Latitude in decimal degrees.
    /// </summary>
    public double? Latitude { get; set; }

    /// <summary>
    /// Longitude in decimal degrees.
    /// </summary>
    public double? Longitude { get; set; }

    /// <summary>
    /// Elevation in meters.
    /// </summary>
    public double? ElevationMeters { get; set; }

    /// <summary>
    /// Formatted street address from the Ambient Weather device location block.
    /// </summary>
    public string? Address { get; set; }

    /// <summary>
    /// City / locality label from the Ambient Weather device location block.
    /// </summary>
    public string? Location { get; set; }

    /// <summary>
    /// Whether this is the user's default station.
    /// </summary>
    public bool IsPrimary { get; set; }

    /// <summary>
    /// Whether this station should appear on the dashboard.
    /// </summary>
    public bool DisplayOnDashboard { get; set; } = true;

    /// <summary>
    /// JSON array of selected metric keys for this station.
    /// </summary>
    public string? SelectedMetricKeysJson { get; set; }

    /// <summary>
    /// IANA timezone identifier for this station (e.g. <c>America/Chicago</c>),
    /// sourced from the Ambient Weather device <c>lastData.tz</c> field during sync.
    /// Null until the first sync that includes a reading with a timezone value.
    /// </summary>
    public string? Tz { get; set; }

    /// <summary>
    /// UTC timestamp of the last station metadata sync.
    /// </summary>
    public DateTime? LastSyncAtUtc { get; set; }

    /// <summary>
    /// User that owns this station.
    /// </summary>
    public AppUser? User { get; set; }
}
