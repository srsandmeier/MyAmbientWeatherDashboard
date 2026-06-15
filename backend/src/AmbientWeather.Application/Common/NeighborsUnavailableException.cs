namespace AmbientWeather.Application.Common;

/// <summary>
/// Indicates that the neighbor comparison feature is unavailable for the current request.
/// Reasons include: the feature is disabled in user preferences, no station coordinates
/// are configured, or no nearby stations have been discovered yet.
/// </summary>
public sealed class NeighborsUnavailableException : ExpectedApplicationException
{
    /// <summary>Initializes a new instance with the default message.</summary>
    public NeighborsUnavailableException()
        : base("Neighbor comparison is unavailable. Enable the feature in Settings and ensure a station with coordinates is configured.")
    {
    }

    /// <summary>Initializes a new instance with a custom message.</summary>
    public NeighborsUnavailableException(string message)
        : base(message)
    {
    }

    /// <summary>Initializes a new instance with a custom message and inner exception.</summary>
    public NeighborsUnavailableException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
