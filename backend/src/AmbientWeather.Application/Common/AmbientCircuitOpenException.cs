namespace AmbientWeather.Application.Common;

/// <summary>
/// Thrown when the Ambient Weather API circuit breaker is open and requests are being rejected
/// to protect against a known-failing downstream service. Maps to HTTP 503.
/// </summary>
public sealed class AmbientCircuitOpenException : ExpectedApplicationException
{
    /// <summary>
    /// Initializes a new instance of the <see cref="AmbientCircuitOpenException"/> class.
    /// </summary>
    public AmbientCircuitOpenException()
        : base("Ambient Weather API is temporarily unavailable. Please try again shortly.")
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="AmbientCircuitOpenException"/> class.
    /// </summary>
    /// <param name="message">The safe error message.</param>
    public AmbientCircuitOpenException(string message)
        : base(message)
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="AmbientCircuitOpenException"/> class.
    /// </summary>
    /// <param name="message">The safe error message.</param>
    /// <param name="innerException">The exception that caused this exception.</param>
    public AmbientCircuitOpenException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
