namespace AmbientWeather.Application.Common;

/// <summary>
/// Thrown when the Ambient Weather API returns 429 after all retry attempts are exhausted.
/// Maps to HTTP 429.
/// </summary>
public sealed class AmbientApiRateLimitException : ExpectedApplicationException
{
    /// <summary>
    /// Initializes a new instance of the <see cref="AmbientApiRateLimitException"/> class.
    /// </summary>
    public AmbientApiRateLimitException()
        : base("The Ambient Weather API rate limit was exceeded. Please try again shortly.")
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="AmbientApiRateLimitException"/> class.
    /// </summary>
    /// <param name="message">The safe error message.</param>
    public AmbientApiRateLimitException(string message)
        : base(message)
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="AmbientApiRateLimitException"/> class.
    /// </summary>
    /// <param name="message">The safe error message.</param>
    /// <param name="innerException">The exception that caused this exception.</param>
    public AmbientApiRateLimitException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
