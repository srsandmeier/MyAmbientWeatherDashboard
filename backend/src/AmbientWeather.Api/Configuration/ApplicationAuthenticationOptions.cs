using System.ComponentModel.DataAnnotations;
using Microsoft.Extensions.Configuration;

namespace AmbientWeather.Api.Configuration;

/// <summary>
/// Strongly typed JWT authentication configuration.
/// </summary>
public sealed class ApplicationAuthenticationOptions
{
    /// <summary>The preferred configuration section name.</summary>
    public const string SectionName = "Authentication";

    /// <summary>JWT authority URL, usually the Auth0 tenant URL.</summary>
    [Url]
    public string? Authority { get; set; }

    /// <summary>JWT audience configured for the backend API.</summary>
    public string? Audience { get; set; }

    /// <summary>Returns true when both authority and audience are configured.</summary>
    public bool IsConfigured => !string.IsNullOrWhiteSpace(Authority) && !string.IsNullOrWhiteSpace(Audience);

    /// <summary>
    /// Binds authentication settings while honoring legacy <c>Auth0</c> aliases.
    /// </summary>
    /// <param name="configuration">Application configuration.</param>
    /// <returns>Bound authentication options.</returns>
    public static ApplicationAuthenticationOptions FromConfiguration(IConfiguration configuration)
    {
        var options = new ApplicationAuthenticationOptions();
        configuration.GetSection(SectionName).Bind(options);
        options.Authority ??= configuration["Auth0:Authority"];
        options.Audience ??= configuration["Auth0:Audience"];
        return options;
    }
}
