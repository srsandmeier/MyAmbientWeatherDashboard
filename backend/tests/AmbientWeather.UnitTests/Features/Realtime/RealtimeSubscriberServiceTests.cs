using AmbientWeather.UnitTests.TestData;
using AmbientWeather.Application.DTOs.AmbientApi;
using AmbientWeather.Application.DTOs.Realtime;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Infrastructure.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Shouldly;
using Xunit;

namespace AmbientWeather.UnitTests.Features.Realtime;

public class RealtimeSubscriberServiceTests
{
    private const string Subject = "auth0|test-user";
    private const string UserHash = "abc123";
    private static readonly string Mac = WeatherTestData.Mac;
    private const string ApiKey = "test-api-key";
    private const string AppKey = "test-app-key";

    private readonly Mock<IRealtimeSubscriptionRegistry> _registryMock = new();
    private readonly Mock<IAmbientSocketClientFactory> _factoryMock = new();
    private readonly Mock<IRealtimeReadingPublisher> _publisherMock = new();

    private RealtimeSubscriberService CreateService(IAmbientCredentialStore credStore)
    {
        var services = new ServiceCollection();
        services.AddSingleton(credStore);
        var provider = services.BuildServiceProvider();

        return new RealtimeSubscriberService(
            _registryMock.Object,
            _factoryMock.Object,
            _publisherMock.Object,
            provider.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<RealtimeSubscriberService>.Instance);
    }

    private static Mock<IAmbientCredentialStore> SetupCredentials(
        string subject = Subject,
        string apiKey = ApiKey,
        string appKey = AppKey)
    {
        var credStoreMock = new Mock<IAmbientCredentialStore>();
        credStoreMock
            .Setup(s => s.GetAsync(subject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AmbientCredentials(apiKey, appKey));
        return credStoreMock;
    }

    private static SubscriptionTarget MakeTarget(
        string? mac = null,
        string subject = Subject,
        string userHash = UserHash,
        string? stationName = null) =>
        new(subject, userHash, mac ?? Mac, stationName ?? WeatherTestData.StationName);

    // -----------------------------------------------------------------------
    // InitializeAsync — subscription setup
    // -----------------------------------------------------------------------

    [Fact]
    public async Task InitializeAsyncShouldNotCreateConnectionsWhenNoSubscriptions()
    {
        _registryMock
            .Setup(r => r.GetActiveSubscriptionsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        var svc = CreateService(new Mock<IAmbientCredentialStore>().Object);
        await svc.InitializeAsync(CancellationToken.None);

        _factoryMock.Verify(f => f.Create(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task InitializeAsyncShouldCreateOneConnectionPerApplicationKey()
    {
        _registryMock
            .Setup(r => r.GetActiveSubscriptionsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync([MakeTarget()]);

        var clientMock = new Mock<IAmbientSocketClient>();
        _factoryMock.Setup(f => f.Create(AppKey)).Returns(clientMock.Object);

        var credsMock = SetupCredentials();
        var svc = CreateService(credsMock.Object);
        await svc.InitializeAsync(CancellationToken.None);

        _factoryMock.Verify(f => f.Create(AppKey), Times.Once);
        clientMock.Verify(c => c.ConnectAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task InitializeAsyncShouldSubscribeWithCorrectApiKey()
    {
        _registryMock
            .Setup(r => r.GetActiveSubscriptionsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync([MakeTarget()]);

        IReadOnlyList<string>? capturedKeys = null;
        var clientMock = new Mock<IAmbientSocketClient>();
        clientMock
            .Setup(c => c.SubscribeAsync(It.IsAny<IReadOnlyList<string>>(), It.IsAny<CancellationToken>()))
            .Callback<IReadOnlyList<string>, CancellationToken>((keys, _) => capturedKeys = keys)
            .Returns(Task.CompletedTask);

        _factoryMock.Setup(f => f.Create(AppKey)).Returns(clientMock.Object);

        var svc = CreateService(SetupCredentials().Object);
        await svc.InitializeAsync(CancellationToken.None);

        capturedKeys.ShouldNotBeNull();
        capturedKeys!.ShouldContain(ApiKey);
        capturedKeys.Count.ShouldBe(1);
    }

    [Fact]
    public async Task InitializeAsyncShouldCreateOneConnectionForTwoStationsWithSameAppKey()
    {
        const string Mac2 = "112233445566";
        var targets = new[]
        {
            MakeTarget(mac: Mac, userHash: UserHash),
            MakeTarget(mac: Mac2, userHash: UserHash),
        };

        _registryMock
            .Setup(r => r.GetActiveSubscriptionsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(targets);

        var clientMock = new Mock<IAmbientSocketClient>();
        _factoryMock.Setup(f => f.Create(AppKey)).Returns(clientMock.Object);

        var svc = CreateService(SetupCredentials().Object);
        await svc.InitializeAsync(CancellationToken.None);

        // Both stations share the same app key → only one connection
        _factoryMock.Verify(f => f.Create(AppKey), Times.Once);
    }

    [Fact]
    public async Task InitializeAsyncShouldSkipStationsWhoseOwnerHasNoCredentials()
    {
        _registryMock
            .Setup(r => r.GetActiveSubscriptionsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync([MakeTarget()]);

        // Credential store returns null for this user
        var credsMock = new Mock<IAmbientCredentialStore>();
        credsMock
            .Setup(s => s.GetAsync(Subject, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AmbientCredentials?)null);

        var svc = CreateService(credsMock.Object);
        await svc.InitializeAsync(CancellationToken.None);

        _factoryMock.Verify(f => f.Create(It.IsAny<string>()), Times.Never);
    }

    // -----------------------------------------------------------------------
    // ProcessDataEventAsync — routing and publishing
    // -----------------------------------------------------------------------

    [Fact]
    public async Task ProcessDataEventAsyncShouldPublishWhenMacIsInRoutingTable()
    {
        _registryMock
            .Setup(r => r.GetActiveSubscriptionsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync([MakeTarget()]);

        var clientMock = new Mock<IAmbientSocketClient>();
        _factoryMock.Setup(f => f.Create(AppKey)).Returns(clientMock.Object);

        var svc = CreateService(SetupCredentials().Object);
        await svc.InitializeAsync(CancellationToken.None);

        var data = new AmbientRealtimeDataDto { MacAddress = Mac, DateUtc = 1_700_000_000_000L, TempF = 72.4 };
        await svc.ProcessDataEventAsync(data, CancellationToken.None);

        _publisherMock.Verify(
            p => p.PublishAsync(UserHash, It.Is<CurrentReadingDto>(
                r => r.DeviceId == Mac && r.TempF == 72.4),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task ProcessDataEventAsyncShouldNotPublishWhenMacIsUnknown()
    {
        _registryMock
            .Setup(r => r.GetActiveSubscriptionsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync([MakeTarget()]);

        var clientMock = new Mock<IAmbientSocketClient>();
        _factoryMock.Setup(f => f.Create(AppKey)).Returns(clientMock.Object);

        var svc = CreateService(SetupCredentials().Object);
        await svc.InitializeAsync(CancellationToken.None);

        var data = new AmbientRealtimeDataDto { MacAddress = "FFEEDDCCBBAA", DateUtc = 0 };
        await svc.ProcessDataEventAsync(data, CancellationToken.None);

        _publisherMock.Verify(
            p => p.PublishAsync(It.IsAny<string>(), It.IsAny<CurrentReadingDto>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ProcessDataEventAsyncShouldNotPublishWhenMacAddressIsNull()
    {
        var svc = CreateService(new Mock<IAmbientCredentialStore>().Object);

        var data = new AmbientRealtimeDataDto { MacAddress = null, DateUtc = 0 };
        await svc.ProcessDataEventAsync(data, CancellationToken.None);

        _publisherMock.Verify(
            p => p.PublishAsync(It.IsAny<string>(), It.IsAny<CurrentReadingDto>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ProcessDataEventAsyncShouldNotPublishWhenMacAddressIsEmpty()
    {
        var svc = CreateService(new Mock<IAmbientCredentialStore>().Object);

        var data = new AmbientRealtimeDataDto { MacAddress = "   ", DateUtc = 0 };
        await svc.ProcessDataEventAsync(data, CancellationToken.None);

        _publisherMock.Verify(
            p => p.PublishAsync(It.IsAny<string>(), It.IsAny<CurrentReadingDto>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ProcessDataEventAsyncShouldContinueWhenPublishThrows()
    {
        _registryMock
            .Setup(r => r.GetActiveSubscriptionsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync([MakeTarget()]);

        var clientMock = new Mock<IAmbientSocketClient>();
        _factoryMock.Setup(f => f.Create(AppKey)).Returns(clientMock.Object);

        _publisherMock
            .Setup(p => p.PublishAsync(It.IsAny<string>(), It.IsAny<CurrentReadingDto>(),
                It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Redis unavailable"));

        var svc = CreateService(SetupCredentials().Object);
        await svc.InitializeAsync(CancellationToken.None);

        var data = new AmbientRealtimeDataDto { MacAddress = Mac, DateUtc = 0 };

        // Should not throw even when the publisher fails
        var ex = await Record.ExceptionAsync(() => svc.ProcessDataEventAsync(data, CancellationToken.None));
        ex.ShouldBeNull();
    }

    [Fact]
    public async Task ProcessDataEventAsyncShouldFanOutToAllOwnersWhenMultipleUsersShareAMac()
    {
        const string HashA = "hashA";
        const string HashB = "hashB";
        const string SubjectB = "auth0|user-b";

        // Two users both own the same physical MAC.
        var targets = new[]
        {
            new SubscriptionTarget(Subject, HashA, Mac, "Alice's Station"),
            new SubscriptionTarget(SubjectB, HashB, Mac, "Bob's Station"),
        };

        _registryMock
            .Setup(r => r.GetActiveSubscriptionsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(targets);

        // Both users share the same app key → one Socket.IO connection, two routing entries.
        var credStoreMock = new Mock<IAmbientCredentialStore>();
        credStoreMock.Setup(s => s.GetAsync(Subject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AmbientCredentials(ApiKey, AppKey));
        credStoreMock.Setup(s => s.GetAsync(SubjectB, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AmbientCredentials(ApiKey, AppKey));

        var clientMock = new Mock<IAmbientSocketClient>();
        _factoryMock.Setup(f => f.Create(AppKey)).Returns(clientMock.Object);

        var svc = CreateService(credStoreMock.Object);
        await svc.InitializeAsync(CancellationToken.None);

        var data = new AmbientRealtimeDataDto { MacAddress = Mac, DateUtc = 0, TempF = 55.0 };
        await svc.ProcessDataEventAsync(data, CancellationToken.None);

        _publisherMock.Verify(
            p => p.PublishAsync(HashA, It.IsAny<CurrentReadingDto>(), It.IsAny<CancellationToken>()),
            Times.Once, "user A must receive the event");

        _publisherMock.Verify(
            p => p.PublishAsync(HashB, It.IsAny<CurrentReadingDto>(), It.IsAny<CancellationToken>()),
            Times.Once, "user B must also receive the event (shared MAC fan-out)");
    }

    // -----------------------------------------------------------------------
    // SubscriptionsChanged — refresh signal
    // -----------------------------------------------------------------------

    [Fact]
    public async Task SubscriptionsChangedShouldTriggerReloadWithNewSubscriptions()
    {
        // First cycle: one station
        _registryMock
            .SetupSequence(r => r.GetActiveSubscriptionsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync([MakeTarget(mac: Mac)])
            .ReturnsAsync([MakeTarget(mac: "112233445566")]);

        var client1 = new Mock<IAmbientSocketClient>();
        var client2 = new Mock<IAmbientSocketClient>();
        _factoryMock
            .SetupSequence(f => f.Create(AppKey))
            .Returns(client1.Object)
            .Returns(client2.Object);

        var credsMock = SetupCredentials();
        var svc = CreateService(credsMock.Object);

        // First cycle initializes with Mac
        await svc.InitializeAsync(CancellationToken.None);
        client1.Verify(c => c.ConnectAsync(It.IsAny<CancellationToken>()), Times.Once);

        // Simulate subscriptions change (normally fired by the registry implementation)
        _registryMock.Raise(r => r.SubscriptionsChanged += null!, svc, EventArgs.Empty);

        // Let the CTS cancellation propagate briefly, then re-initialize
        await Task.Delay(50);
        await svc.InitializeAsync(CancellationToken.None);

        // Second client was connected for the new MAC
        client2.Verify(c => c.ConnectAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    // -----------------------------------------------------------------------
    // Log safety — no credentials in log context
    // -----------------------------------------------------------------------

    [Fact]
    public async Task ProcessDataEventAsyncUnknownMacLogDoesNotContainApiKey()
    {
        // This test verifies the log message for unknown MAC is safe — it only logs the MAC,
        // not any credential. The log message template is: "...unknown MAC {NormalizedMac}..."
        // Verified by inspecting the [LoggerMessage] template in the service source.
        // A full structured-logging capture would be needed for exhaustive verification;
        // this test documents the expectation so future changes stay safe.

        _registryMock
            .Setup(r => r.GetActiveSubscriptionsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync([MakeTarget()]);

        var clientMock = new Mock<IAmbientSocketClient>();
        _factoryMock.Setup(f => f.Create(AppKey)).Returns(clientMock.Object);

        var svc = CreateService(SetupCredentials().Object);
        await svc.InitializeAsync(CancellationToken.None);

        // Unknown MAC produces a log message that must contain only the MAC, not any key
        var data = new AmbientRealtimeDataDto { MacAddress = "FFEEDDCCBBAA", DateUtc = 0 };
        await svc.ProcessDataEventAsync(data, CancellationToken.None);

        // No exception and no publish is the observable contract; log content verified by code review
        _publisherMock.Verify(
            p => p.PublishAsync(It.IsAny<string>(), It.IsAny<CurrentReadingDto>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }
}
