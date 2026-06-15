namespace AmbientWeather.Application.Common;

/// <summary>
/// Indicates that an authenticated user must save Ambient Weather credentials before the request can be completed.
/// </summary>
public sealed class AmbientCredentialsRequiredException : ExpectedApplicationException
{
    /// <summary>
    /// Initializes a new instance of the <see cref="AmbientCredentialsRequiredException"/> class.
    /// </summary>
    public AmbientCredentialsRequiredException()
        : base("Ambient Weather credentials must be saved before device history can be retrieved.")
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="AmbientCredentialsRequiredException"/> class.
    /// </summary>
    /// <param name="message">The safe error message.</param>
    public AmbientCredentialsRequiredException(string message)
        : base(message)
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="AmbientCredentialsRequiredException"/> class.
    /// </summary>
    /// <param name="message">The safe error message.</param>
    /// <param name="innerException">The exception that caused this exception.</param>
    public AmbientCredentialsRequiredException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
