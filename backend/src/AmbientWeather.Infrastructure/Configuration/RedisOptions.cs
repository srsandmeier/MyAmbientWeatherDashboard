using System.ComponentModel.DataAnnotations;
using Microsoft.Extensions.Configuration;

namespace AmbientWeather.Infrastructure.Configuration;

/// <summary>
/// Strongly typed Redis configuration used for distributed cache and realtime pub/sub.
/// </summary>
public sealed class RedisOptions
{
    /// <summary>The configuration section name.</summary>
    public const string SectionName = "Redis";

    /// <summary>Redis connection string. May be omitted in Development and Testing.</summary>
    public string? ConnectionString { get; set; }

    /// <summary>Prefix applied to distributed cache keys.</summary>
    [Required]
    [StringLength(128, MinimumLength = 1)]
    public string InstanceName { get; set; } = "AmbientWeatherDashboard:";

    /// <summary>Returns true when Redis is configured and should be used.</summary>
    public bool IsConfigured => !string.IsNullOrWhiteSpace(ConnectionString);

    /// <summary>
    /// Binds Redis settings while honoring both <c>ConnectionStrings:Redis</c> and
    /// <c>Redis:ConnectionString</c> for local environment compatibility.
    /// </summary>
    /// <param name="configuration">Application configuration.</param>
    /// <returns>Bound Redis options.</returns>
    public static RedisOptions FromConfiguration(IConfiguration configuration)
    {
        var options = new RedisOptions();
        configuration.GetSection(SectionName).Bind(options);
        options.ConnectionString =
            configuration.GetConnectionString("Redis")
            ?? configuration[SectionName + ":ConnectionString"]
            ?? options.ConnectionString;
        return options;
    }
}
