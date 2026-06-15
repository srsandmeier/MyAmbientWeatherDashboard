namespace AmbientWeather.Application.Common;

/// <summary>
/// Indicates that the authenticated user has saved Ambient credentials but has not yet
/// synced any weather stations. The caller must trigger a device sync before the requested
/// operation can proceed. Distinct from <see cref="AmbientCredentialsRequiredException"/>
/// so the frontend can display a contextually accurate prompt.
/// </summary>
public sealed class AmbientStationsRequiredException : ExpectedApplicationException
{
    /// <summary>
    /// Initializes a new instance of the <see cref="AmbientStationsRequiredException"/> class.
    /// </summary>
    public AmbientStationsRequiredException()
        : base("No weather stations have been synced. Navigate to Settings and sync your devices.")
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="AmbientStationsRequiredException"/> class.
    /// </summary>
    /// <param name="message">The safe error message.</param>
    public AmbientStationsRequiredException(string message)
        : base(message)
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="AmbientStationsRequiredException"/> class.
    /// </summary>
    /// <param name="message">The safe error message.</param>
    /// <param name="innerException">The exception that caused this exception.</param>
    public AmbientStationsRequiredException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
