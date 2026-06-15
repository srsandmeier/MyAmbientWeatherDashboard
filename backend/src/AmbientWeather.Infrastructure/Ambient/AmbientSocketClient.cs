using AmbientWeather.Application.DTOs.AmbientApi;
using AmbientWeather.Application.Interfaces;
using Microsoft.Extensions.Logging;
using SocketIOClient;

namespace AmbientWeather.Infrastructure.Ambient;

/// <summary>
/// Wraps a <see cref="SocketIO"/> connection to the Ambient Weather realtime endpoint.
/// Translates raw Socket.IO <c>data</c> events into typed <see cref="AmbientRealtimeDataDto"/>
/// payloads and raises <see cref="DataReceived"/>. Malformed payloads are logged and discarded
/// so a single bad frame cannot bring down the connection.
/// </summary>
internal sealed partial class AmbientSocketClient(
    SocketIO socketIo,
    ILogger<AmbientSocketClient> logger) : IAmbientSocketClient
{
    /// <inheritdoc />
    public event EventHandler<AmbientDataReceivedEventArgs>? DataReceived;

    /// <inheritdoc />
    public async Task ConnectAsync(CancellationToken cancellationToken = default)
    {
        socketIo.On("data", async ctx =>
        {
            try
            {
                var data = ctx.GetValue<AmbientRealtimeDataDto>(0);
                if (data is not null)
                    DataReceived?.Invoke(this, new AmbientDataReceivedEventArgs(data));
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                LogMalformedDataEvent(logger, ex);
            }
            await Task.CompletedTask.ConfigureAwait(false);
        });

        await socketIo.ConnectAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public Task SubscribeAsync(IReadOnlyList<string> apiKeys, CancellationToken cancellationToken = default) =>
        socketIo.EmitAsync("subscribe", new object[] { new { apiKeys } }, cancellationToken);

    /// <inheritdoc />
    public Task DisconnectAsync() => socketIo.DisconnectAsync();

    /// <inheritdoc />
    public ValueTask DisposeAsync()
    {
        socketIo.Dispose();
        return ValueTask.CompletedTask;
    }

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "Ambient realtime: received a 'data' event that could not be deserialized; frame discarded.")]
    private static partial void LogMalformedDataEvent(ILogger logger, Exception ex);
}
