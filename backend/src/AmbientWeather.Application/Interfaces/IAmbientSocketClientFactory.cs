namespace AmbientWeather.Application.Interfaces;

/// <summary>
/// Creates <see cref="IAmbientSocketClient"/> instances for a given Ambient application key.
/// The factory is registered as a singleton; each call to <see cref="Create"/> produces a
/// new, unconnected client.
/// </summary>
public interface IAmbientSocketClientFactory
{
    /// <summary>
    /// Creates a new, unconnected socket client that will connect to the Ambient realtime
    /// endpoint using <paramref name="applicationKey"/> in the URL query string.
    /// </summary>
    /// <param name="applicationKey">
    /// The Ambient Weather application key used to authenticate the Socket.IO connection.
    /// Never passed as a plain string to Serilog or any logging sink.
    /// </param>
    IAmbientSocketClient Create(string applicationKey);
}
