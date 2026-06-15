namespace AmbientWeather.Application.Common;

/// <summary>
/// Base exception for expected application-level failures that can be mapped to API responses.
/// </summary>
public abstract class ExpectedApplicationException : Exception
{
    /// <summary>
    /// Initializes a new instance of the <see cref="ExpectedApplicationException"/> class.
    /// </summary>
    protected ExpectedApplicationException()
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="ExpectedApplicationException"/> class.
    /// </summary>
    /// <param name="message">The safe error message.</param>
    protected ExpectedApplicationException(string message)
        : base(message)
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="ExpectedApplicationException"/> class.
    /// </summary>
    /// <param name="message">The safe error message.</param>
    /// <param name="innerException">The exception that caused this exception.</param>
    protected ExpectedApplicationException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
