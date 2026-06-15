using System.Collections.Specialized;
using AmbientWeather.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SocketIOClient;
using SocketIOClient.Common;

namespace AmbientWeather.Infrastructure.Ambient;

/// <summary>
/// Creates <see cref="AmbientSocketClient"/> instances configured to connect to the
/// Ambient Weather realtime endpoint at <c>rt2.ambientweather.net</c>.
/// The application key is passed via the Socket.IO query string, never in a log message.
/// </summary>
public sealed class AmbientSocketClientFactory(
    IConfiguration configuration,
    ILoggerFactory loggerFactory) : IAmbientSocketClientFactory
{
    private static readonly Uri DefaultRealtimeBaseUrl = new("https://rt2.ambientweather.net");

    /// <inheritdoc />
    public IAmbientSocketClient Create(string applicationKey)
    {
        var baseUrl = configuration["AmbientRealtime:BaseUrl"] is { Length: > 0 } url
            ? new Uri(url)
            : DefaultRealtimeBaseUrl;

        var query = new NameValueCollection
        {
            ["api"] = "1",
            // applicationKey goes in the query string, not in any log sink
            ["applicationKey"] = applicationKey,
        };

        var options = new SocketIOOptions
        {
            Query = query,
            EIO = EngineIO.V3,      // Ambient uses Socket.IO v2 (Engine.IO v3)
            Reconnection = true,
            ReconnectionAttempts = 10,
            ReconnectionDelayMax = 60_000,
            ConnectionTimeout = TimeSpan.FromSeconds(15),
        };

        var socketIo = new SocketIO(baseUrl, options, services =>
        {
            services.AddSystemTextJson(AmbientJsonOptions.Default);
        });
        var clientLogger = loggerFactory.CreateLogger<AmbientSocketClient>();
        return new AmbientSocketClient(socketIo, clientLogger);
    }
}
