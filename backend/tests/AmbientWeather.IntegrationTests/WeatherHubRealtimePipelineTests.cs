using AmbientWeather.UnitTests.TestData;
using System.Diagnostics.CodeAnalysis;
using System.Text.Json;
using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.Realtime;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Infrastructure.Ambient;
using AmbientWeather.Infrastructure.Services;
using AmbientWeather.IntegrationTests.Auth;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Shouldly;
using StackExchange.Redis;
using Testcontainers.Redis;

namespace AmbientWeather.IntegrationTests;

/// <summary>
/// Integration tests for the full Redis → SignalR realtime pipeline.
/// Uses a Testcontainers Redis instance so the real <c>RedisRealtimeReadingSubscriber</c>
/// subscribes to pub/sub. A reading published directly to the Redis channel must reach a
/// connected SignalR client as a <c>ReadingUpdated</c> event.
/// </summary>
[SuppressMessage("Design", "CA1001", Justification = "xUnit IAsyncLifetime disposes _factory in DisposeAsync.")]
public sealed class WeatherHubRealtimePipelineTests : IAsyncLifetime
{
    private const string UserSubject = "auth0|redis-pipeline-test-user";

    private readonly RedisContainer _redis = new RedisBuilder()
        .WithImage("redis:7-alpine")
        .Build();

    private WeatherHubRedisTestFactory? _factory;

    /// <inheritdoc />
    public async Task InitializeAsync()
    {
        await _redis.StartAsync().ConfigureAwait(false);
        _factory = new WeatherHubRedisTestFactory(_redis.GetConnectionString());
    }

    /// <inheritdoc />
    public async Task DisposeAsync()
    {
        if (_factory is not null)
            await _factory.DisposeAsync().ConfigureAwait(false);
        await _redis.DisposeAsync().ConfigureAwait(false);
    }

    /// <summary>
    /// Full end-to-end pipeline: publish a JSON payload directly to Redis pub/sub →
    /// <c>RedisRealtimeReadingSubscriber</c> deserializes it → <c>WeatherHub</c> fans it out →
    /// the connected SignalR client receives <c>ReadingUpdated</c>.
    /// </summary>
    [Fact]
    public async Task RedisPublishShouldDeliverReadingUpdatedToSignalRClient()
    {
        var factory = _factory!;
        var userHash = UserSegmentHash.Compute(UserSubject);

        var received = new TaskCompletionSource<CurrentReadingDto>(
            TaskCreationOptions.RunContinuationsAsynchronously);

        var connection = BuildConnection(factory, UserSubject);

        try
        {
            connection.On<ReadingUpdatedEventDto>("ReadingUpdated", dto =>
                received.TrySetResult(dto.Reading));

            await connection.StartAsync();
            connection.State.ShouldBe(HubConnectionState.Connected);

            var reading = new CurrentReadingDto
            {
                DeviceId = WeatherTestData.Mac,
                TimestampUtc = DateTime.UtcNow,
                ReceivedAtUtc = DateTime.UtcNow,
                TempF = 99.9,
            };
            var payload = JsonSerializer.Serialize(
                new ReadingUpdatedEventDto { Reading = reading },
                AmbientJsonOptions.Default);

            var multiplexer = factory.Services.GetRequiredService<IConnectionMultiplexer>();
            var channel = RedisChannel.Literal($"ambient:readings:{userHash}");

            // Retry-publish until the message is received or the deadline is hit.
            // The ProcessQueueAsync background loop may start asynchronously on slow CI runners;
            // retrying every 250 ms removes the fixed-delay race without extending the happy-path.
            using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(15));
            while (!received.Task.IsCompleted && !deadline.Token.IsCancellationRequested)
            {
                await multiplexer.GetSubscriber().PublishAsync(channel, payload);
                try
                {
                    await received.Task.WaitAsync(TimeSpan.FromMilliseconds(250));
                }
                catch (TimeoutException) { /* not yet; retry */ }
            }

            var result = await received.Task.WaitAsync(TimeSpan.FromSeconds(1));
            result.TempF.ShouldBe(99.9);
            result.DeviceId.ShouldBe(WeatherTestData.Mac);
        }
        finally
        {
            await connection.StopAsync();
        }
    }

    private static HubConnection BuildConnection(WeatherHubRedisTestFactory factory, string subject)
    {
        var baseAddress = factory.Server.BaseAddress;

        return new HubConnectionBuilder()
            .WithUrl(
                new Uri(baseAddress, "/hubs/weather"),
                opts =>
                {
                    opts.HttpMessageHandlerFactory = _ => factory.Server.CreateHandler();
                    opts.Headers.Add(TestAuthHandler.UserSubjectHeader, subject);
                })
            .AddJsonProtocol()
            .Build();
    }
}

/// <summary>
/// Web application factory that wires the app with a real Testcontainers Redis instance.
/// Because <c>ConfigureAppConfiguration</c> runs after Infrastructure DI in the minimal-API
/// hosting model, the Redis connection string cannot reach <c>AddRealtime</c> in time.
/// Instead, <c>ConfigureTestServices</c> registers <c>IConnectionMultiplexer</c> directly
/// and replaces the null subscriber with the real <c>RedisRealtimeReadingSubscriber</c> so
/// the full pub/sub → SignalR pipeline is exercised.
/// </summary>
public sealed class WeatherHubRedisTestFactory(string redisConnectionString)
    : WebApplicationFactory<Program>
{
    /// <inheritdoc />
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration(config =>
            config.AddInMemoryCollection(new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["AmbientWeather:ApplicationKey"] = "test-application-key",
            }));
        builder.ConfigureTestServices(services =>
        {
            services
                .AddAuthentication(opts =>
                {
                    opts.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
                    opts.DefaultChallengeScheme = TestAuthHandler.SchemeName;
                })
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
                    TestAuthHandler.SchemeName, _ => { });

            services.PostConfigure<AuthenticationOptions>(options =>
            {
                options.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
                options.DefaultChallengeScheme = TestAuthHandler.SchemeName;
            });

            // Inject the real IConnectionMultiplexer backed by the Testcontainers Redis instance.
            // AddRealtime registered NullRealtimeReadingSubscriber because no Redis CS was in
            // config at registration time; replace it with the real implementation here.
            services.AddSingleton<IConnectionMultiplexer>(_ =>
                ConnectionMultiplexer.Connect(redisConnectionString));

            services.RemoveAll<IRealtimeReadingSubscriber>();
            services.AddSingleton<IRealtimeReadingSubscriber, RedisRealtimeReadingSubscriber>();
        });
    }
}
