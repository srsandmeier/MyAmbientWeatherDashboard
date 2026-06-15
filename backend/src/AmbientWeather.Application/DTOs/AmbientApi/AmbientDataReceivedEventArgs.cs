namespace AmbientWeather.Application.DTOs.AmbientApi;

/// <summary>
/// Event arguments for the <c>DataReceived</c> event raised by an Ambient Socket.IO client
/// when the server emits a <c>data</c> frame.
/// </summary>
public sealed class AmbientDataReceivedEventArgs(AmbientRealtimeDataDto data) : EventArgs
{
    /// <summary>Gets the deserialized realtime reading payload.</summary>
    public AmbientRealtimeDataDto Data { get; } = data;
}
