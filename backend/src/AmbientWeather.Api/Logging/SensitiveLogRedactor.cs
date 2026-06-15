namespace AmbientWeather.Api.Logging;

/// <summary>
/// Identifies and redacts property names that contain secret or credential material.
/// Used by log enrichers and destructuring policies to prevent secret leakage into logs.
/// </summary>
public static class SensitiveLogRedactor
{
    /// <summary>Placeholder substituted for any redacted value.</summary>
    public const string RedactedPlaceholder = "[REDACTED]";

    private static readonly HashSet<string> SensitiveKeys =
        new(StringComparer.OrdinalIgnoreCase)
        {
            "apikey",
            "api_key",
            "applicationkey",
            "application_key",
            "password",
            "secret",
            "token",
            "authorization",
            "cookie",
            "set-cookie",
            "x-api-key",
            "x-application-key",
        };

    /// <summary>Returns <see langword="true"/> when <paramref name="key"/> matches a known sensitive property name.</summary>
    /// <param name="key">The property or header name to check.</param>
    public static bool IsSensitiveKey(string key) =>
        !string.IsNullOrEmpty(key) && SensitiveKeys.Contains(key);

    /// <summary>
    /// Returns <see cref="RedactedPlaceholder"/> when <paramref name="key"/> is sensitive;
    /// otherwise returns <paramref name="value"/> unchanged.
    /// </summary>
    /// <param name="key">The property or header name.</param>
    /// <param name="value">The original value.</param>
    public static string RedactIfSensitive(string key, string value) =>
        IsSensitiveKey(key) ? RedactedPlaceholder : value;
}
