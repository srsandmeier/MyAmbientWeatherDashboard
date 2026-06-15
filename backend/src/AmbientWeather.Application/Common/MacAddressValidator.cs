using System.Text.RegularExpressions;

namespace AmbientWeather.Application.Common;

/// <summary>
/// Validates and normalizes Ambient Weather device MAC addresses.
/// </summary>
public static partial class MacAddressValidator
{
    /// <summary>
    /// Determines whether the supplied value is a supported MAC address format.
    /// </summary>
    /// <param name="macAddress">The MAC address to validate.</param>
    /// <returns>True when the value is colon-separated, hyphen-separated, or 12 hexadecimal characters.</returns>
    public static bool IsValid(string? macAddress)
    {
        return !string.IsNullOrWhiteSpace(macAddress)
            && MacAddressRegex().IsMatch(macAddress);
    }

    /// <summary>
    /// Normalizes a valid MAC address to uppercase hexadecimal without separators.
    /// </summary>
    /// <param name="macAddress">The MAC address to normalize.</param>
    /// <returns>The normalized MAC address.</returns>
    /// <exception cref="ArgumentException">Thrown when the MAC address is invalid.</exception>
    public static string Normalize(string macAddress)
    {
        if (!IsValid(macAddress))
        {
            throw new ArgumentException(
                "MAC address must be in format XX:XX:XX:XX:XX:XX, XX-XX-XX-XX-XX-XX, or XXXXXXXXXXXX.",
                nameof(macAddress));
        }

        return macAddress
            .Replace(":", string.Empty, StringComparison.Ordinal)
            .Replace("-", string.Empty, StringComparison.Ordinal)
            .ToUpperInvariant();
    }

    /// <summary>
    /// Compares two supported MAC address formats by normalizing separators and casing.
    /// </summary>
    /// <param name="left">The first MAC address.</param>
    /// <param name="right">The second MAC address.</param>
    /// <returns>True when both values are valid MAC addresses and normalize to the same value.</returns>
    public static bool EqualsNormalized(string? left, string? right)
    {
        return IsValid(left)
            && IsValid(right)
            && string.Equals(Normalize(left!), Normalize(right!), StringComparison.Ordinal);
    }

    /// <summary>
    /// Formats a supported MAC address as uppercase colon-separated hex pairs for providers
    /// that require the physical MAC representation in URL path segments.
    /// </summary>
    /// <param name="macAddress">The MAC address to format.</param>
    /// <returns>The uppercase colon-separated MAC address.</returns>
    public static string ToColonSeparated(string macAddress)
    {
        var normalized = Normalize(macAddress);
        return string.Create(
            17,
            normalized,
            static (span, value) =>
            {
                span[0] = value[0];
                span[1] = value[1];
                span[2] = ':';
                span[3] = value[2];
                span[4] = value[3];
                span[5] = ':';
                span[6] = value[4];
                span[7] = value[5];
                span[8] = ':';
                span[9] = value[6];
                span[10] = value[7];
                span[11] = ':';
                span[12] = value[8];
                span[13] = value[9];
                span[14] = ':';
                span[15] = value[10];
                span[16] = value[11];
            });
    }

    [GeneratedRegex(@"^(([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}|[0-9A-Fa-f]{12})$", RegexOptions.ExplicitCapture, matchTimeoutMilliseconds: 100)]
    private static partial Regex MacAddressRegex();
}
