namespace AmbientWeather.Application.DTOs.Realtime;

/// <summary>
/// Payload of the SignalR <c>ReadingUpdated</c> event pushed to connected browser clients.
/// Wrapping <see cref="CurrentReadingDto"/> in a named envelope keeps the wire format
/// extensible without breaking existing clients when metadata fields are added later.
/// </summary>
public record ReadingUpdatedEventDto
{
    /// <summary>Gets the updated current reading for the station.</summary>
    public required CurrentReadingDto Reading { get; init; }
}
