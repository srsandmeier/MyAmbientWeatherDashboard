namespace AmbientWeather.Workers;

/// <summary>
/// Configuration options for the history sync worker.
/// </summary>
public sealed class HistorySyncWorkerOptions
{
    /// <summary>
    /// Whether periodic history sync is enabled.
    /// </summary>
    public bool Enabled { get; set; }

    /// <summary>
    /// MAC address of the device to synchronize.
    /// </summary>
    public string? DeviceMacAddress { get; set; }

    /// <summary>
    /// Server-side Ambient Weather API key for the legacy single-device sync path.
    /// <para>
    /// <b>Security:</b> Must be supplied via .NET User Secrets or a secrets manager — never
    /// via <c>appsettings.json</c> or an unencrypted config file. This property exists only
    /// as a stepping-stone for the optional legacy single-device sync path.
    /// Per-user credential lookup via <c>IAmbientCredentialStore</c> is used by the BFF device endpoints.
    /// </para>
    /// </summary>
    public string? ApiKey { get; set; }

    /// <summary>
    /// Server-side Ambient Weather application key for the legacy single-device sync path.
    /// <para>
    /// <b>Security:</b> Must be supplied via .NET User Secrets or a secrets manager — never
    /// via <c>appsettings.json</c> or an unencrypted config file. This property exists only
    /// as a stepping-stone for the optional legacy single-device sync path.
    /// Per-user credential lookup via <c>IAmbientCredentialStore</c> is used by the BFF device endpoints.
    /// </para>
    /// </summary>
    public string? ApplicationKey { get; set; }

    /// <summary>
    /// Number of seconds between sync attempts.
    /// </summary>
    public int IntervalSeconds { get; set; } = 300;

    /// <summary>
    /// Maximum number of readings to request per sync.
    /// </summary>
    public int Limit { get; set; } = 288;
}
