using System.ComponentModel.DataAnnotations;
using System.Reflection;
using Microsoft.Extensions.Configuration;

namespace AmbientWeather.Infrastructure.Configuration;

/// <summary>
/// Configures the outbound HTTP User-Agent sent to upstream weather providers.
/// </summary>
public sealed class UserAgentOptions
{
    /// <summary>
    /// Configuration section name for User-Agent settings.
    /// </summary>
    public const string SectionName = "UserAgent";

    /// <summary>
    /// Default product token used when no explicit User-Agent is configured.
    /// </summary>
    public const string DefaultProductName = "AmbientWeatherDashboard";

    /// <summary>
    /// Fully formatted User-Agent header value. If set, this wins over generated values.
    /// </summary>
    [StringLength(256)]
    public string? Value { get; set; }

    /// <summary>
    /// Product token to use when generating the User-Agent header.
    /// </summary>
    [StringLength(64)]
    public string? ProductName { get; set; }

    /// <summary>
    /// Product version to use when generating the User-Agent header.
    /// </summary>
    [StringLength(64)]
    public string? Version { get; set; }

    /// <summary>
    /// Contact information appended to the generated User-Agent for provider policy compliance.
    /// </summary>
    [StringLength(128)]
    public string? Contact { get; set; }

    /// <summary>
    /// Gets a value indicating whether the User-Agent includes provider-friendly contact information.
    /// </summary>
    public bool HasProviderContact => ToHeaderValue().Contains('(') && ToHeaderValue().Contains(')');

    /// <summary>
    /// Builds options from configuration while preserving the legacy scalar <c>UserAgent</c> value.
    /// </summary>
    /// <param name="configuration">The application configuration.</param>
    /// <param name="assembly">Optional assembly used for version discovery.</param>
    /// <returns>The resolved User-Agent options.</returns>
    public static UserAgentOptions FromConfiguration(IConfiguration configuration, Assembly? assembly = null)
    {
        var options = new UserAgentOptions();
        configuration.GetSection(SectionName).Bind(options);

        var legacyValue = configuration[SectionName];
        if (!string.IsNullOrWhiteSpace(legacyValue))
        {
            options.Value = legacyValue;
        }

        options.ProductName = FirstNonBlank(options.ProductName, configuration["AppSlug"], DefaultProductName);
        options.Version = FirstNonBlank(options.Version, GetAssemblyVersion(assembly ?? typeof(UserAgentOptions).Assembly));

        return options;
    }

    /// <summary>
    /// Returns a fully formatted User-Agent header value.
    /// </summary>
    /// <returns>The User-Agent header value.</returns>
    public string ToHeaderValue()
    {
        if (!string.IsNullOrWhiteSpace(Value))
        {
            return Value.Trim();
        }

        var product = SanitizeProductToken(ProductName);
        var version = SanitizeProductVersion(Version);
        var headerValue = string.IsNullOrWhiteSpace(version)
            ? product
            : $"{product}/{version}";

        return string.IsNullOrWhiteSpace(Contact)
            ? headerValue
            : $"{headerValue} ({Contact.Trim()})";
    }

    private static string? FirstNonBlank(params string?[] values)
    {
        foreach (var value in values)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value.Trim();
            }
        }

        return null;
    }

    private static string? GetAssemblyVersion(Assembly assembly)
    {
        var informationalVersion = assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()
            ?.InformationalVersion;

        return FirstNonBlank(informationalVersion, assembly.GetName().Version?.ToString());
    }

    private static string SanitizeProductToken(string? value)
    {
        var token = FirstNonBlank(value, DefaultProductName)!;
        var chars = token
            .Select(character => char.IsLetterOrDigit(character) || character is '.' or '_' or '-'
                ? character
                : '-')
            .ToArray();

        return new string(chars).Trim('-');
    }

    private static string? SanitizeProductVersion(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var chars = value
            .Trim()
            .Select(character => char.IsLetterOrDigit(character) || character is '.' or '_' or '-' or '+'
                ? character
                : '-')
            .ToArray();

        return new string(chars).Trim('-');
    }
}
