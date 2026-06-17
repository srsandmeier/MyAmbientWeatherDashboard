using AmbientWeather.UnitTests.TestData;
using System.Net;
using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.Realtime;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.IntegrationTests.Auth;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Shouldly;
using Xunit;

namespace AmbientWeather.IntegrationTests;

/// <summary>
/// Integration tests for the SignalR <c>WeatherHub</c> at <c>/hubs/weather</c>.
/// Uses <see cref="TestApplicationFactory"/> with <see cref="TestAuthHandler"/> for
/// auth and mocks <see cref="IRealtimeReadingSubscriber"/> to avoid Redis dependencies.
/// </summary>
public sealed class WeatherHubTests : IClassFixture<WeatherHubTestFactory>
{
    private const string UserSubject = "auth0|hub-test-user-a";
    private const string OtherSubject = "auth0|hub-test-user-b";

    private readonly WeatherHubTestFactory _factory;

    public WeatherHubTests(WeatherHubTestFactory factory)
    {
        _factory = factory;
        _factory.SubscriberMock.Reset();
    }

    // -----------------------------------------------------------------------
    // Unauthorized — HTTP negotiate handshake returns 401
    // -----------------------------------------------------------------------

    [Fact]
    public async Task WeatherHubShouldReturn401WhenNoAuthHeader()
    {
        using var client = _factory.CreateClient();
        var response = await client.PostAsync("/hubs/weather/negotiate?negotiateVersion=1", null);
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    // -----------------------------------------------------------------------
    // Authorized connection — connects and joins correct group
    // -----------------------------------------------------------------------

    [Fact]
    public async Task WeatherHubShouldAllowAuthenticatedConnection()
    {
        var connection = BuildConnection(UserSubject);

        try
        {
            await connection.StartAsync();
            connection.State.ShouldBe(HubConnectionState.Connected);
        }
        finally
        {
            await connection.StopAsync();
        }
    }

    [Fact]
    public async Task WeatherHubShouldAllowAuthenticatedConnectionWithAccessTokenQuery()
    {
        var connection = BuildConnectionWithAccessToken(UserSubject);

        try
        {
            await connection.StartAsync();
            connection.State.ShouldBe(HubConnectionState.Connected);
        }
        finally
        {
            await connection.StopAsync();
        }
    }

    [Fact]
    public async Task WeatherHubShouldSubscribeUserOnConnect()
    {
        var expectedHash = UserSegmentHash.Compute(UserSubject);
        var connection = BuildConnection(UserSubject);

        try
        {
            await connection.StartAsync();

            _factory.SubscriberMock.Verify(
                s => s.SubscribeAsync(expectedHash, It.IsAny<CancellationToken>()),
                Times.Once);
        }
        finally
        {
            await connection.StopAsync();
        }
    }

    [Fact]
    public async Task WeatherHubShouldUnsubscribeUserOnDisconnect()
    {
        var expectedHash = UserSegmentHash.Compute(UserSubject);
        var unsubscribed = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

        _factory.SubscriberMock
            .Setup(s => s.UnsubscribeAsync(expectedHash, It.IsAny<CancellationToken>()))
            .Callback(() => unsubscribed.TrySetResult())
            .Returns(Task.CompletedTask);

        var connection = BuildConnection(UserSubject);

        await connection.StartAsync();
        await connection.StopAsync();

        // OnDisconnectedAsync runs server-side after the transport closes; wait for it.
        await unsubscribed.Task.WaitAsync(TimeSpan.FromSeconds(5));

        _factory.SubscriberMock.Verify(
            s => s.UnsubscribeAsync(expectedHash, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task WeatherHubShouldConnectWhenSubjectIsInRawSubClaim()
    {
        // JsonWebTokenHandler (.NET 8+) keeps the Auth0 "sub" claim as-is rather than
        // mapping it to ClaimTypes.NameIdentifier. WeatherHub must accept both forms.
        var expectedHash = UserSegmentHash.Compute(UserSubject);
        var connection = BuildConnectionWithRawSubClaim(UserSubject);

        try
        {
            await connection.StartAsync();
            connection.State.ShouldBe(HubConnectionState.Connected);

            _factory.SubscriberMock.Verify(
                s => s.SubscribeAsync(expectedHash, It.IsAny<CancellationToken>()),
                Times.Once);
        }
        finally
        {
            await connection.StopAsync();
        }
    }

    [Fact]
    public async Task WeatherHubShouldRemainFunctionalAfterConnectionWithMissingNameIdentifierClaim()
    {
        // When a principal authenticates but lacks a NameIdentifier claim, OnConnectedAsync
        // throws HubException. SignalR then calls OnDisconnectedAsync. Before the fix,
        // OnDisconnectedAsync also threw, leaving the connection lifecycle in an error state.
        // After the fix the catch block in OnDisconnectedAsync handles the missing claim
        // gracefully, so the server remains functional for subsequent valid connections.
        var badConnection = BuildConnectionWithoutNameIdentifier();
        _ = await Record.ExceptionAsync(() => badConnection.StartAsync());

        // Server must be operational after the failed connection attempt.
        var goodConnection = BuildConnection(UserSubject);
        try
        {
            await goodConnection.StartAsync();
            goodConnection.State.ShouldBe(HubConnectionState.Connected);
        }
        finally
        {
            await goodConnection.StopAsync();
        }
    }

    // -----------------------------------------------------------------------
    // ReadingUpdated fan-out — message reaches the correct user group
    // -----------------------------------------------------------------------

    [Fact]
    public async Task WeatherHubShouldDeliverReadingUpdatedToCorrectUser()
    {
        var userHash = UserSegmentHash.Compute(UserSubject);
        var received = new TaskCompletionSource<CurrentReadingDto>(
            TaskCreationOptions.RunContinuationsAsynchronously);

        var connection = BuildConnection(UserSubject);

        try
        {
            connection.On<ReadingUpdatedEventDto>("ReadingUpdated", dto =>
                received.TrySetResult(dto.Reading));

            await connection.StartAsync();

            // Push a message directly to the user's group via IWeatherHubPusher.
            var pusher = _factory.Services.GetRequiredService<IWeatherHubPusher>();
            var reading = new CurrentReadingDto
            {
                DeviceId = WeatherTestData.Mac,
                TimestampUtc = DateTime.UtcNow,
                ReceivedAtUtc = DateTime.UtcNow,
                TempF = 72.4,
            };
            await pusher.SendReadingUpdatedAsync(userHash, new ReadingUpdatedEventDto { Reading = reading });

            var result = await received.Task.WaitAsync(TimeSpan.FromSeconds(5));
            result.TempF.ShouldBe(72.4);
            result.DeviceId.ShouldBe(WeatherTestData.Mac);
        }
        finally
        {
            await connection.StopAsync();
        }
    }

    [Fact]
    public async Task WeatherHubShouldNotDeliverOtherUsersMessages()
    {
        var userAHash = UserSegmentHash.Compute(UserSubject);

        var userADelivered = new TaskCompletionSource<CurrentReadingDto>(
            TaskCreationOptions.RunContinuationsAsynchronously);
        var userBReceived = new List<CurrentReadingDto>();

        var connA = BuildConnection(UserSubject);
        var connB = BuildConnection(OtherSubject);

        try
        {
            connA.On<ReadingUpdatedEventDto>("ReadingUpdated", dto => userADelivered.TrySetResult(dto.Reading));
            connB.On<ReadingUpdatedEventDto>("ReadingUpdated", dto => userBReceived.Add(dto.Reading));

            await connA.StartAsync();
            await connB.StartAsync();

            var pusher = _factory.Services.GetRequiredService<IWeatherHubPusher>();
            var reading = new CurrentReadingDto
            {
                DeviceId = WeatherTestData.Mac,
                TimestampUtc = DateTime.UtcNow,
                ReceivedAtUtc = DateTime.UtcNow,
            };

            // Push only to user A; wait for confirmed delivery before asserting user B got nothing.
            await pusher.SendReadingUpdatedAsync(userAHash, new ReadingUpdatedEventDto { Reading = reading });
            await userADelivered.Task.WaitAsync(TimeSpan.FromSeconds(5));

            userBReceived.Count.ShouldBe(0, "user B must not receive user A's message");
        }
        finally
        {
            await connA.StopAsync();
            await connB.StopAsync();
        }
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private HubConnection BuildConnection(string subject)
    {
        var baseAddress = _factory.Server.BaseAddress;

        return new HubConnectionBuilder()
            .WithUrl(
                new Uri(baseAddress, "/hubs/weather"),
                opts =>
                {
                    opts.HttpMessageHandlerFactory = _ => _factory.Server.CreateHandler();
                    opts.Headers.Add(TestAuthHandler.UserSubjectHeader, subject);
                })
            .AddJsonProtocol()
            .Build();
    }

    private HubConnection BuildConnectionWithAccessToken(string subject)
    {
        var baseAddress = _factory.Server.BaseAddress;

        return new HubConnectionBuilder()
            .WithUrl(
                new Uri(baseAddress, $"/hubs/weather?access_token={Uri.EscapeDataString(subject)}"),
                opts =>
                {
                    opts.HttpMessageHandlerFactory = _ => _factory.Server.CreateHandler();
                })
            .AddJsonProtocol()
            .Build();
    }

    private HubConnection BuildConnectionWithRawSubClaim(string subject)
    {
        var baseAddress = _factory.Server.BaseAddress;

        return new HubConnectionBuilder()
            .WithUrl(
                new Uri(baseAddress, "/hubs/weather"),
                opts =>
                {
                    opts.HttpMessageHandlerFactory = _ => _factory.Server.CreateHandler();
                    opts.Headers.Add(TestAuthHandler.UserSubjectHeader, subject);
                    opts.Headers.Add(TestAuthHandler.UseRawSubClaimHeader, "true");
                })
            .AddJsonProtocol()
            .Build();
    }

    private HubConnection BuildConnectionWithoutNameIdentifier()
    {
        var baseAddress = _factory.Server.BaseAddress;

        return new HubConnectionBuilder()
            .WithUrl(
                new Uri(baseAddress, "/hubs/weather"),
                opts =>
                {
                    opts.HttpMessageHandlerFactory = _ => _factory.Server.CreateHandler();
                    opts.Headers.Add(TestAuthHandler.UserSubjectHeader, "test-no-identifier-user");
                    opts.Headers.Add(TestAuthHandler.OmitNameIdentifierHeader, "true");
                })
            .AddJsonProtocol()
            .Build();
    }
}

/// <summary>
/// Web application factory for <see cref="WeatherHubTests"/>.
/// Replaces <see cref="IRealtimeReadingSubscriber"/> with a mock so tests never touch Redis.
/// Mirrors <see cref="TestApplicationFactory"/> configuration inline because that factory is sealed.
/// </summary>
public sealed class WeatherHubTestFactory : WebApplicationFactory<Program>
{
    /// <summary>Mock subscriber — reset between tests.</summary>
    public Mock<IRealtimeReadingSubscriber> SubscriberMock { get; } = new();

    /// <inheritdoc />
    protected override void ConfigureWebHost(Microsoft.AspNetCore.Hosting.IWebHostBuilder builder)
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

            // Replace the real subscriber (which needs Redis) with a controllable mock.
            services.AddSingleton<IRealtimeReadingSubscriber>(_ => SubscriberMock.Object);
        });
    }

    /// <summary>Creates an HTTP client with the test user subject header.</summary>
    public HttpClient CreateAuthenticatedClient(string subject)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.UserSubjectHeader, subject);
        return client;
    }
}
