using AmbientWeather.Application.DTOs.AmbientApi;

namespace AmbientWeather.Application.Interfaces;

/// <summary>
/// Abstraction over a single Ambient Weather Socket.IO connection.
/// One instance represents one connection to <c>rt2.ambientweather.net</c> for a
/// specific <c>applicationKey</c>. Multiple user API keys are multiplexed over a
/// single instance via <see cref="SubscribeAsync"/>.
/// </summary>
public interface IAmbientSocketClient : IAsyncDisposable
{
    /// <summary>
    /// Raised when the Ambient server emits a <c>data</c> event for any device
    /// whose owner's API key is included in an earlier <see cref="SubscribeAsync"/> call.
    /// Handlers must not throw; exceptions are caught and logged by the implementation.
    /// </summary>
    event EventHandler<AmbientDataReceivedEventArgs>? DataReceived;

    /// <summary>
    /// Connects to the Ambient realtime endpoint.
    /// Must be called before <see cref="SubscribeAsync"/>.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task ConnectAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Subscribes the connection to data events for the given Ambient user API keys.
    /// Calling this again with a new list replaces the previous subscription.
    /// </summary>
    /// <param name="apiKeys">One or more Ambient personal API keys to monitor.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task SubscribeAsync(IReadOnlyList<string> apiKeys, CancellationToken cancellationToken = default);

    /// <summary>Disconnects gracefully from the Ambient realtime endpoint.</summary>
    Task DisconnectAsync();
}
