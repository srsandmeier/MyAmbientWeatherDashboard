namespace AmbientWeather.Application.Common;

/// <summary>
/// Thrown when the Ambient Weather API rejects a request due to invalid or missing credentials
/// (HTTP 401 or 403). Maps to HTTP 401.
/// </summary>
public sealed class AmbientApiAuthException : ExpectedApplicationException
{
    /// <summary>
    /// Initializes a new instance of the <see cref="AmbientApiAuthException"/> class.
    /// </summary>
    public AmbientApiAuthException()
        : base("Ambient Weather API credentials were rejected. Verify your API key and application key in Settings.")
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="AmbientApiAuthException"/> class.
    /// </summary>
    /// <param name="message">The safe error message.</param>
    public AmbientApiAuthException(string message)
        : base(message)
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="AmbientApiAuthException"/> class.
    /// </summary>
    /// <param name="message">The safe error message.</param>
    /// <param name="innerException">The exception that caused this exception.</param>
    public AmbientApiAuthException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
