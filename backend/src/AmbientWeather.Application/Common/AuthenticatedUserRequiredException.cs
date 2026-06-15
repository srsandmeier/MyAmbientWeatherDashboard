namespace AmbientWeather.Application.Common;

/// <summary>
/// Indicates that an authenticated user identity is required to complete an application request.
/// </summary>
public sealed class AuthenticatedUserRequiredException : ExpectedApplicationException
{
    /// <summary>
    /// Initializes a new instance of the <see cref="AuthenticatedUserRequiredException"/> class.
    /// </summary>
    public AuthenticatedUserRequiredException()
        : base("An authenticated user is required to complete this request.")
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="AuthenticatedUserRequiredException"/> class.
    /// </summary>
    /// <param name="message">The safe error message.</param>
    public AuthenticatedUserRequiredException(string message)
        : base(message)
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="AuthenticatedUserRequiredException"/> class.
    /// </summary>
    /// <param name="message">The safe error message.</param>
    /// <param name="innerException">The exception that caused this exception.</param>
    public AuthenticatedUserRequiredException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
