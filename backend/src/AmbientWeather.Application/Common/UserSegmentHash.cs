using System.Security.Cryptography;
using System.Text;

namespace AmbientWeather.Application.Common;

/// <summary>
/// Computes the short hex hash used as the user-scoped segment in Redis cache keys and
/// pub/sub channel names. Using a hash keeps raw Auth0 subject strings out of observable
/// infrastructure (Redis key space, log lines, channel listings).
/// </summary>
public static class UserSegmentHash
{
    /// <summary>
    /// Returns the lowercase hex SHA-256 hash of <paramref name="subject"/>.
    /// Deterministic: the same subject always produces the same hash.
    /// </summary>
    public static string Compute(string subject)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(subject));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
