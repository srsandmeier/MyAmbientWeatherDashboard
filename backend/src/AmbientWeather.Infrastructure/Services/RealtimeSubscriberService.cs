using System.Threading.Channels;
using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.AmbientApi;
using AmbientWeather.Application.Features.Realtime;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AmbientWeather.Infrastructure.Services;

/// <summary>
/// Hosted service that maintains persistent Socket.IO connections to the Ambient Weather
/// realtime endpoint (<c>rt2.ambientweather.net</c>) on behalf of all users with saved
/// credentials and synced stations.
/// <para>
/// Incoming <c>data</c> events are routed by MAC address to the owning user's Redis pub/sub
/// channel via <see cref="IRealtimeReadingPublisher"/>. Ambient credentials are resolved
/// internally and never appear in log output. A single connection is maintained per unique
/// <c>applicationKey</c>; multiple user API keys are multiplexed over it.
/// </para>
/// </summary>
public sealed partial class RealtimeSubscriberService : BackgroundService
{
    private readonly IRealtimeSubscriptionRegistry _registry;
    private readonly IAmbientSocketClientFactory _socketClientFactory;
    private readonly IRealtimeReadingPublisher _publisher;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<RealtimeSubscriberService> _logger;

    // Routing table: normalized MAC address → list of (userHash, display name)
    // A list is required because multiple users can configure the same physical station;
    // a plain dictionary would silently drop all but the last owner.
    // Written only in InitializeAsync; read concurrently from data-event callbacks.
    // Volatile reference swap ensures callbacks always see the latest table.
    private volatile IReadOnlyDictionary<string, IReadOnlyList<(string UserHash, string? StationName)>> _routingTable =
        new Dictionary<string, IReadOnlyList<(string, string?)>>(StringComparer.OrdinalIgnoreCase);

    // Active socket connections, cleared and rebuilt on each initialization cycle.
    private readonly List<IAmbientSocketClient> _connections = [];

    // Bounded channel routes data events from Socket.IO callbacks to the consumer loop.
    // Bounded with DropOldest prevents unbounded growth if the consumer falls behind.
    private readonly Channel<AmbientRealtimeDataDto> _dataChannel =
        Channel.CreateBounded<AmbientRealtimeDataDto>(
            new BoundedChannelOptions(1_000) { FullMode = BoundedChannelFullMode.DropOldest });

    // Cancelled by OnSubscriptionsChanged to trigger a clean refresh cycle.
    private CancellationTokenSource _refreshCts = new();

    private const int InitialBackoffMs = 2_000;
    private const int MaxBackoffMs = 300_000;

    /// <summary>Initializes a new <see cref="RealtimeSubscriberService"/>.</summary>
    public RealtimeSubscriberService(
        IRealtimeSubscriptionRegistry registry,
        IAmbientSocketClientFactory socketClientFactory,
        IRealtimeReadingPublisher publisher,
        IServiceScopeFactory scopeFactory,
        ILogger<RealtimeSubscriberService> logger)
    {
        _registry = registry;
        _socketClientFactory = socketClientFactory;
        _publisher = publisher;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    /// <inheritdoc />
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _registry.SubscriptionsChanged += OnSubscriptionsChanged;

        // The consumer loop runs for the full service lifetime so data events are
        // processed in-order with proper cancellation — no unbounded fire-and-forget.
        var consumerTask = ConsumeDataEventsAsync(stoppingToken);

        try
        {
            var backoffMs = InitialBackoffMs;

            while (!stoppingToken.IsCancellationRequested)
            {
                using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
                    stoppingToken, _refreshCts.Token);

                try
                {
                    await InitializeAsync(linkedCts.Token).ConfigureAwait(false);

                    // Connections are live. Wait until a refresh signal or stop.
                    await Task.Delay(Timeout.Infinite, linkedCts.Token).ConfigureAwait(false);
                    backoffMs = InitialBackoffMs;
                }
                catch (OperationCanceledException) when (!stoppingToken.IsCancellationRequested)
                {
                    // SubscriptionsChanged fired — reinitialize.
                    LogRefreshTriggered(_logger);
                    backoffMs = InitialBackoffMs;
                }
                catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
                {
                    LogInitializationFailed(_logger, ex);
                    await Task.Delay(backoffMs, stoppingToken).ConfigureAwait(false);
                    backoffMs = Math.Min(backoffMs * 2, MaxBackoffMs);
                }
                finally
                {
                    await TearDownAsync().ConfigureAwait(false);
                }
            }
        }
        finally
        {
            _registry.SubscriptionsChanged -= OnSubscriptionsChanged;
            _dataChannel.Writer.TryComplete();
            await consumerTask.ConfigureAwait(ConfigureAwaitOptions.SuppressThrowing);
        }
    }

    private async Task ConsumeDataEventsAsync(CancellationToken stoppingToken)
    {
        try
        {
            await foreach (var data in _dataChannel.Reader
                .ReadAllAsync(stoppingToken)
                .ConfigureAwait(false))
            {
                await ProcessDataEventAsync(data, stoppingToken).ConfigureAwait(false);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Normal shutdown.
        }
    }

    /// <summary>
    /// Queries the registry for active subscriptions, loads credentials, and opens one
    /// Socket.IO connection per unique application key.
    /// </summary>
    internal async Task InitializeAsync(CancellationToken cancellationToken)
    {
        var subscriptions = await _registry
            .GetActiveSubscriptionsAsync(cancellationToken)
            .ConfigureAwait(false);

        if (subscriptions.Count == 0)
        {
            LogNoActiveSubscriptions(_logger);
            _routingTable = new Dictionary<string, IReadOnlyList<(string, string?)>>(StringComparer.OrdinalIgnoreCase);
            return;
        }

        var credsBySubject = await LoadCredentialsAsync(subscriptions, cancellationToken)
            .ConfigureAwait(false);

        var active = subscriptions
            .Where(s => credsBySubject.ContainsKey(s.Subject))
            .ToList();

        if (active.Count == 0)
        {
            LogNoCredentialedSubscriptions(_logger);
            _routingTable = new Dictionary<string, IReadOnlyList<(string, string?)>>(StringComparer.OrdinalIgnoreCase);
            return;
        }

        _routingTable = BuildRoutingTable(active);
        await OpenConnectionsAsync(active, credsBySubject, cancellationToken).ConfigureAwait(false);
        LogInitialized(_logger, _routingTable.Count, _connections.Count);
    }

    private async Task<Dictionary<string, AmbientCredentials>> LoadCredentialsAsync(
        IReadOnlyList<SubscriptionTarget> subscriptions,
        CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var credStore = scope.ServiceProvider.GetRequiredService<IAmbientCredentialStore>();

        var result = new Dictionary<string, AmbientCredentials>(StringComparer.Ordinal);
        foreach (var subject in subscriptions.Select(s => s.Subject).Distinct(StringComparer.Ordinal))
        {
            var creds = await credStore.GetAsync(subject, cancellationToken).ConfigureAwait(false);
            if (creds is not null)
                result[subject] = creds;
        }

        return result;
    }

    private static Dictionary<string, IReadOnlyList<(string UserHash, string? StationName)>> BuildRoutingTable(
        IEnumerable<SubscriptionTarget> active)
    {
        var table = new Dictionary<string, IReadOnlyList<(string, string?)>>(StringComparer.OrdinalIgnoreCase);
        foreach (var grp in active.GroupBy(t => t.MacAddress, StringComparer.OrdinalIgnoreCase))
            table[grp.Key] = grp.Select(t => (t.UserHash, t.StationName)).ToList();
        return table;
    }

    private async Task OpenConnectionsAsync(
        IEnumerable<SubscriptionTarget> active,
        Dictionary<string, AmbientCredentials> credsBySubject,
        CancellationToken cancellationToken)
    {
        var byAppKey = active.GroupBy(
            s => credsBySubject[s.Subject].ApplicationKey, StringComparer.Ordinal);

        // Connect all application-key groups concurrently; each group's handshake is independent.
        var clients = await Task.WhenAll(byAppKey.Select(group =>
            ConnectGroupAsync(group, credsBySubject, cancellationToken))).ConfigureAwait(false);

        _connections.AddRange(clients);
    }

    private async Task<IAmbientSocketClient> ConnectGroupAsync(
        IGrouping<string, SubscriptionTarget> group,
        Dictionary<string, AmbientCredentials> credsBySubject,
        CancellationToken cancellationToken)
    {
        var apiKeys = group
            .Select(s => credsBySubject[s.Subject].ApiKey)
            .Distinct(StringComparer.Ordinal)
            .ToList();

        var client = _socketClientFactory.Create(group.Key);
        client.DataReceived += (_, e) => _dataChannel.Writer.TryWrite(e.Data);

        await client.ConnectAsync(cancellationToken).ConfigureAwait(false);
        await client.SubscribeAsync(apiKeys, cancellationToken).ConfigureAwait(false);

        return client;
    }

    /// <summary>
    /// Routes an incoming Ambient <c>data</c> event to the owning user's Redis channel.
    /// Unknown or missing MAC addresses are logged and skipped without crashing.
    /// </summary>
    internal async Task ProcessDataEventAsync(
        AmbientRealtimeDataDto data,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(data.MacAddress))
        {
            LogMissingMacAddress(_logger);
            return;
        }

        string normalized;
        try
        {
            normalized = MacAddressValidator.Normalize(data.MacAddress);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogInvalidMacAddress(_logger, ex);
            return;
        }

        var table = _routingTable;
        if (!table.TryGetValue(normalized, out var targets))
        {
            LogUnknownMacAddress(_logger, normalized);
            return;
        }

        foreach (var routing in targets)
        {
            var station = new WeatherStation
            {
                MacAddress = normalized,
                Name = routing.StationName ?? normalized,
            };

            var reading = CurrentReadingMapper.FromDeviceData(data, station);

            try
            {
                await _publisher.PublishAsync(routing.UserHash, reading, cancellationToken)
                    .ConfigureAwait(false);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                LogPublishFailed(_logger, ex, normalized);
            }
        }
    }

    private async Task TearDownAsync()
    {
        foreach (var client in _connections)
        {
            try
            {
                await client.DisconnectAsync().ConfigureAwait(false);
                await client.DisposeAsync().ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                LogTearDownFailed(_logger, ex);
            }
        }

        _connections.Clear();
        _routingTable = new Dictionary<string, IReadOnlyList<(string, string?)>>(StringComparer.OrdinalIgnoreCase);
    }

    private void OnSubscriptionsChanged(object? sender, EventArgs e)
    {
        // Atomically replace the CTS so the outer loop gets a fresh token next cycle,
        // then cancel the old one to break out of Task.Delay(Timeout.Infinite, ...).
        var old = Interlocked.Exchange(ref _refreshCts, new CancellationTokenSource());
        old.Cancel();
        old.Dispose();
    }

    // -------------------------------------------------------------------------
    // Structured log messages — no credential values in any message
    // -------------------------------------------------------------------------

    [LoggerMessage(Level = LogLevel.Information,
        Message = "Realtime subscriber initialized: {StationCount} station(s) across {ConnectionCount} connection(s).")]
    private static partial void LogInitialized(ILogger logger, int stationCount, int connectionCount);

    [LoggerMessage(Level = LogLevel.Information,
        Message = "Realtime subscriber: no active subscriptions — waiting for credentials or stations to be configured.")]
    private static partial void LogNoActiveSubscriptions(ILogger logger);

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "Realtime subscriber: subscriptions exist but no users have valid credentials; skipping connection.")]
    private static partial void LogNoCredentialedSubscriptions(ILogger logger);

    [LoggerMessage(Level = LogLevel.Information,
        Message = "Realtime subscriber: subscription refresh triggered; tearing down and reinitializing.")]
    private static partial void LogRefreshTriggered(ILogger logger);

    [LoggerMessage(Level = LogLevel.Error,
        Message = "Realtime subscriber: initialization failed; will retry with backoff.")]
    private static partial void LogInitializationFailed(ILogger logger, Exception ex);

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "Realtime subscriber: received a data event with a missing MAC address; skipping.")]
    private static partial void LogMissingMacAddress(ILogger logger);

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "Realtime subscriber: received a data event with an invalid MAC address format; skipping.")]
    private static partial void LogInvalidMacAddress(ILogger logger, Exception ex);

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "Realtime subscriber: received a data event for unknown MAC {NormalizedMac}; not in routing table.")]
    private static partial void LogUnknownMacAddress(ILogger logger, string normalizedMac);

    [LoggerMessage(Level = LogLevel.Error,
        Message = "Realtime subscriber: failed to publish reading for MAC {NormalizedMac}.")]
    private static partial void LogPublishFailed(ILogger logger, Exception ex, string normalizedMac);

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "Realtime subscriber: error during connection teardown.")]
    private static partial void LogTearDownFailed(ILogger logger, Exception ex);
}
