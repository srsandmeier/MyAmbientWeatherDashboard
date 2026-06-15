using AmbientWeather.UnitTests.TestData;
using System.Security.Cryptography;
using System.Text;
using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.AmbientApi;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Infrastructure.Services;
using AmbientWeather.UnitTests.Common;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Moq;
using Shouldly;
#pragma warning disable CA1506 // Avoid excessive class coupling — test helper intentionally wires all service dependencies

namespace AmbientWeather.UnitTests.Infrastructure.Services;

public class DeviceHistoryServiceTests
{
    private static readonly string MacAddress = WeatherTestData.ColonMac;

    [Fact]
    public async Task GetDeviceHistoryAsyncReturnsCachedHistoryWhenRequestInputsMatch()
    {
        var restClient = new Mock<IAmbientRestClient>();
        restClient
            .Setup(client => client.GetDeviceHistoryAsync(
                MacAddress,
                TestConstants.ApiKey,
                TestConstants.ApplicationKey,
                288,
                null,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateHistory(72.1));

        var service = CreateService(restClient.Object);

        var first = await service.GetDeviceHistoryAsync(MacAddress);
        var second = await service.GetDeviceHistoryAsync(MacAddress);

        second.Readings.Single().TempF.ShouldBe(first.Readings.Single().TempF);
        restClient.Verify(
            client => client.GetDeviceHistoryAsync(
                MacAddress,
                TestConstants.ApiKey,
                TestConstants.ApplicationKey,
                288,
                null,
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task GetDeviceHistoryAsyncUsesSeparateCacheEntriesWhenLimitDiffers()
    {
        var restClient = new Mock<IAmbientRestClient>();
        restClient
            .Setup(client => client.GetDeviceHistoryAsync(
                MacAddress,
                TestConstants.ApiKey,
                TestConstants.ApplicationKey,
                12,
                null,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateHistory(70.0));
        restClient
            .Setup(client => client.GetDeviceHistoryAsync(
                MacAddress,
                TestConstants.ApiKey,
                TestConstants.ApplicationKey,
                24,
                null,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateHistory(71.0));

        var service = CreateService(restClient.Object);

        var first = await service.GetDeviceHistoryAsync(MacAddress, 12);
        var second = await service.GetDeviceHistoryAsync(MacAddress, 24);

        first.Readings.Single().TempF.ShouldBe(70.0);
        second.Readings.Single().TempF.ShouldBe(71.0);
        restClient.Verify(
            client => client.GetDeviceHistoryAsync(
                MacAddress,
                TestConstants.ApiKey,
                TestConstants.ApplicationKey,
                It.IsAny<int>(),
                null,
                It.IsAny<CancellationToken>()),
            Times.Exactly(2));
    }

    [Fact]
    public async Task InvalidateCacheAsyncInvalidatesAllEntriesForDevice()
    {
        var restClient = new Mock<IAmbientRestClient>();
        restClient
            .SetupSequence(client => client.GetDeviceHistoryAsync(
                MacAddress,
                TestConstants.ApiKey,
                TestConstants.ApplicationKey,
                288,
                null,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateHistory(70.0))
            .ReturnsAsync(CreateHistory(75.0));

        var service = CreateService(restClient.Object);

        await service.GetDeviceHistoryAsync(MacAddress);
        await service.InvalidateCacheAsync(MacAddress);
        var refreshed = await service.GetDeviceHistoryAsync(MacAddress);

        refreshed.Readings.Single().TempF.ShouldBe(75.0);
        restClient.Verify(
            client => client.GetDeviceHistoryAsync(
                MacAddress,
                TestConstants.ApiKey,
                TestConstants.ApplicationKey,
                288,
                null,
                It.IsAny<CancellationToken>()),
            Times.Exactly(2));
    }

    [Fact]
    public async Task InvalidateAllCachesAsyncInvalidatesExistingCacheEntries()
    {
        var restClient = new Mock<IAmbientRestClient>();
        restClient
            .SetupSequence(client => client.GetDeviceHistoryAsync(
                MacAddress,
                TestConstants.ApiKey,
                TestConstants.ApplicationKey,
                288,
                null,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateHistory(70.0))
            .ReturnsAsync(CreateHistory(76.0));

        var service = CreateService(restClient.Object);

        await service.GetDeviceHistoryAsync(MacAddress);
        await service.InvalidateAllCachesAsync();
        var refreshed = await service.GetDeviceHistoryAsync(MacAddress);

        refreshed.Readings.Single().TempF.ShouldBe(76.0);
        restClient.Verify(
            client => client.GetDeviceHistoryAsync(
                MacAddress,
                TestConstants.ApiKey,
                TestConstants.ApplicationKey,
                288,
                null,
                It.IsAny<CancellationToken>()),
            Times.Exactly(2));
    }

    [Theory]
    [InlineData("not-a-mac")]
    [InlineData("AA:BB:CC")]
    public async Task GetDeviceHistoryAsyncThrowsArgumentExceptionWhenMacAddressIsInvalid(string macAddress)
    {
        var restClient = new Mock<IAmbientRestClient>();
        var service = CreateService(restClient.Object);

        await Should.ThrowAsync<ArgumentException>(() => service.GetDeviceHistoryAsync(macAddress));

        restClient.Verify(
            client => client.GetDeviceHistoryAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<int>(),
                It.IsAny<DateTime?>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }

    public static TheoryData<string> SupportedMacAddressFormats => new()
    {
        "AA-BB-CC-DD-EE-FF",
        WeatherTestData.Mac,
    };

    [Theory]
    [MemberData(nameof(SupportedMacAddressFormats))]
    public async Task GetDeviceHistoryAsyncAcceptsSupportedMacAddressFormats(string macAddress)
    {
        var restClient = new Mock<IAmbientRestClient>();
        restClient
            .Setup(client => client.GetDeviceHistoryAsync(
                macAddress,
                TestConstants.ApiKey,
                TestConstants.ApplicationKey,
                288,
                null,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateHistory(70.0));
        var service = CreateService(restClient.Object);

        var result = await service.GetDeviceHistoryAsync(macAddress);

        result.Readings.Single().TempF.ShouldBe(70.0);
    }

    [Fact]
    public async Task GetDeviceHistoryAsyncThrowsWhenUserIsNotAuthenticated()
    {
        var restClient = new Mock<IAmbientRestClient>();
        var service = CreateService(restClient.Object, isAuthenticated: false);

        await Should.ThrowAsync<AuthenticatedUserRequiredException>(() => service.GetDeviceHistoryAsync(MacAddress));
    }

    [Fact]
    public async Task GetDeviceHistoryAsyncThrowsWhenCredentialsAreMissing()
    {
        var restClient = new Mock<IAmbientRestClient>();
        var service = CreateService(restClient.Object, credentialsMissing: true);

        await Should.ThrowAsync<AmbientCredentialsRequiredException>(() => service.GetDeviceHistoryAsync(MacAddress));
    }

    [Fact]
    public async Task InvalidateCacheAsyncShouldUseUserScopedKeyNotGlobalKey()
    {
        // Verifies that InvalidateCacheAsync calls RemoveAsync with a key that includes
        // the current user's hashed subject, so invalidating for user A cannot affect user B.
        var hashA = HashSubject("auth0|user-a");
        var hashB = HashSubject("auth0|user-b");

        var cache = new Mock<IDistributedCache>();
        cache.Setup(c => c.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
             .ReturnsAsync((byte[]?)null);

        var serviceA = CreateService(Mock.Of<IAmbientRestClient>(), subject: "auth0|user-a", sharedCache: cache.Object);

        await serviceA.InvalidateCacheAsync(MacAddress);

        cache.Verify(
            c => c.RemoveAsync(
                It.Is<string>(k => k.Contains(hashA, StringComparison.Ordinal)
                                   && k.Contains("mac:", StringComparison.Ordinal)),
                It.IsAny<CancellationToken>()),
            Times.Once);

        cache.Verify(
            c => c.RemoveAsync(
                It.Is<string>(k => k.Contains(hashB, StringComparison.Ordinal)),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task InvalidateAllCachesAsyncShouldUseUserScopedVersionKeyNotGlobalKey()
    {
        // Verifies that InvalidateAllCachesAsync sets a user-scoped version key, so bumping
        // the version for user A does not affect user B's cached entries.
        var hashA = HashSubject("auth0|user-a");
        var hashB = HashSubject("auth0|user-b");

        var cache = new Mock<IDistributedCache>();
        cache.Setup(c => c.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
             .ReturnsAsync((byte[]?)null);

        var serviceA = CreateService(Mock.Of<IAmbientRestClient>(), subject: "auth0|user-a", sharedCache: cache.Object);

        await serviceA.InvalidateAllCachesAsync();

        cache.Verify(
            c => c.SetAsync(
                It.Is<string>(k => k.Contains(hashA, StringComparison.Ordinal)
                                   && k.Contains("user-version", StringComparison.Ordinal)),
                It.IsAny<byte[]>(),
                It.Is<DistributedCacheEntryOptions>(options => HasVersionExpiration(options)),
                It.IsAny<CancellationToken>()),
            Times.Once);

        cache.Verify(
            c => c.SetAsync(
                It.Is<string>(k => k.Contains(hashB, StringComparison.Ordinal)),
                It.IsAny<byte[]>(),
                It.IsAny<DistributedCacheEntryOptions>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task GetDeviceHistoryAsyncShouldSetExpiringVersionKeys()
    {
        var restClient = new Mock<IAmbientRestClient>();
        restClient
            .Setup(client => client.GetDeviceHistoryAsync(
                MacAddress,
                TestConstants.ApiKey,
                TestConstants.ApplicationKey,
                288,
                null,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateHistory(70.0));

        var cache = new Mock<IDistributedCache>();
        cache.Setup(c => c.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
             .ReturnsAsync((byte[]?)null);

        var service = CreateService(restClient.Object, sharedCache: cache.Object);

        await service.GetDeviceHistoryAsync(MacAddress);

        cache.Verify(
            c => c.SetAsync(
                It.Is<string>(k => k.Contains("version", StringComparison.Ordinal)),
                It.IsAny<byte[]>(),
                It.Is<DistributedCacheEntryOptions>(options => HasVersionExpiration(options)),
                It.IsAny<CancellationToken>()),
            Times.AtLeast(2));
    }

    private static string HashSubject(string subject) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(subject))).ToLowerInvariant();

    private static bool HasVersionExpiration(DistributedCacheEntryOptions options) =>
        options.AbsoluteExpirationRelativeToNow.HasValue
        && options.AbsoluteExpirationRelativeToNow.Value > TimeSpan.FromHours(1);

    private static DeviceHistoryService CreateService(
        IAmbientRestClient restClient,
        bool isAuthenticated = true,
        bool credentialsMissing = false,
        string? subject = null,
        IDistributedCache? sharedCache = null)
    {
        var cache = sharedCache
            ?? new MemoryDistributedCache(Microsoft.Extensions.Options.Options.Create(new MemoryDistributedCacheOptions()));
        var logger = Mock.Of<ILogger<DeviceHistoryService>>();
        var resolvedSubject = subject ?? TestConstants.AuthProviderSubject;

        var credentialStore = new Mock<IAmbientCredentialStore>();
        credentialStore
            .Setup(store => store.GetAsync(resolvedSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(credentialsMissing
                ? null
                : new AmbientCredentials(TestConstants.ApiKey, TestConstants.ApplicationKey));

        var currentUserService = new Mock<ICurrentUserService>();
        currentUserService.SetupGet(s => s.IsAuthenticated).Returns(isAuthenticated);
        currentUserService.SetupGet(s => s.AuthProviderSubject).Returns(resolvedSubject);
        currentUserService.SetupGet(s => s.Email).Returns(TestConstants.Email);

        return new DeviceHistoryService(
            restClient,
            credentialStore.Object,
            currentUserService.Object,
            cache,
            logger);
    }

    private static DeviceHistoryResponseDto CreateHistory(double tempF)
    {
        return new DeviceHistoryResponseDto
        {
            Readings =
            [
                new WeatherReadingDto
                {
                    DateUtc = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    TempF = tempF
                }
            ],
            TotalReadings = 1
        };
    }
}
