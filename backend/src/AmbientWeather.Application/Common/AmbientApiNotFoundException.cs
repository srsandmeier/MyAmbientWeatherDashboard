namespace AmbientWeather.Application.Common;

/// <summary>
/// Thrown when the Ambient Weather API returns 404 for a requested resource.
/// Maps to HTTP 404.
/// </summary>
public sealed class AmbientApiNotFoundException : ExpectedApplicationException
{
    /// <summary>
    /// Initializes a new instance of the <see cref="AmbientApiNotFoundException"/> class.
    /// </summary>
    public AmbientApiNotFoundException()
        : base("The requested Ambient Weather resource was not found.")
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="AmbientApiNotFoundException"/> class.
    /// </summary>
    /// <param name="message">The safe error message.</param>
    public AmbientApiNotFoundException(string message)
        : base(message)
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="AmbientApiNotFoundException"/> class.
    /// </summary>
    /// <param name="message">The safe error message.</param>
    /// <param name="innerException">The exception that caused this exception.</param>
    public AmbientApiNotFoundException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
