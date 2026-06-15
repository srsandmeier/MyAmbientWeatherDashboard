using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.AmbientApi;
using AmbientWeather.Application.Features.Settings.Commands;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.UnitTests.Common;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Shouldly;

namespace AmbientWeather.UnitTests.Features.Settings;

public sealed class SaveAmbientCredentialsCommandHandlerTests
{
    private const string ApiKey = "api-key";
    private const string ApplicationKey = "application-key";

    [Fact]
    public async Task HandleShouldValidateCredentialsBeforeSaving()
    {
        var ambientRestClient = new Mock<IAmbientRestClient>();
        ambientRestClient
            .Setup(client => client.GetDevicesAsync(ApiKey, ApplicationKey, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<DeviceDto>());
        var credentialStore = new Mock<IAmbientCredentialStore>();
        var stationStore = new Mock<IUserStationStore>();
        var realtimeRegistry = new Mock<IRealtimeSubscriptionRegistry>();
        stationStore
            .Setup(s => s.SyncStationsAsync(It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<IReadOnlyList<DeviceDto>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);
        var handler = new SaveAmbientCredentialsCommandHandler(
            ambientRestClient.Object,
            credentialStore.Object,
            stationStore.Object,
            CurrentUserServiceMockFactory.Create(),
            realtimeRegistry.Object,
            NullLogger<SaveAmbientCredentialsCommandHandler>.Instance);

        await handler.Handle(new SaveAmbientCredentialsCommand(ApiKey, ApplicationKey), CancellationToken.None);

        ambientRestClient.Verify(
            client => client.GetDevicesAsync(ApiKey, ApplicationKey, It.IsAny<CancellationToken>()),
            Times.Once);
        credentialStore.Verify(
            store => store.SaveAsync(
                TestConstants.AuthProviderSubject,
                TestConstants.Email,
                ApiKey,
                ApplicationKey,
                It.IsAny<CancellationToken>()),
            Times.Once);
        realtimeRegistry.Verify(
            registry => registry.InvalidateAsync(TestConstants.AuthProviderSubject, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task HandleShouldNotSaveWhenAmbientValidationFails()
    {
        var ambientRestClient = new Mock<IAmbientRestClient>();
        ambientRestClient
            .Setup(client => client.GetDevicesAsync(ApiKey, ApplicationKey, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new AmbientApiAuthException());
        var credentialStore = new Mock<IAmbientCredentialStore>();
        var handler = new SaveAmbientCredentialsCommandHandler(
            ambientRestClient.Object,
            credentialStore.Object,
            Mock.Of<IUserStationStore>(),
            CurrentUserServiceMockFactory.Create(),
            Mock.Of<IRealtimeSubscriptionRegistry>(),
            NullLogger<SaveAmbientCredentialsCommandHandler>.Instance);

        await Should.ThrowAsync<AmbientApiAuthException>(
            () => handler.Handle(new SaveAmbientCredentialsCommand(ApiKey, ApplicationKey), CancellationToken.None));

        credentialStore.Verify(
            store => store.SaveAsync(
                It.IsAny<string>(),
                It.IsAny<string?>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task HandleShouldThrowWhenUserIsNotAuthenticated()
    {
        var handler = new SaveAmbientCredentialsCommandHandler(
            Mock.Of<IAmbientRestClient>(),
            Mock.Of<IAmbientCredentialStore>(),
            Mock.Of<IUserStationStore>(),
            CurrentUserServiceMockFactory.Create(isAuthenticated: false),
            Mock.Of<IRealtimeSubscriptionRegistry>(),
            NullLogger<SaveAmbientCredentialsCommandHandler>.Instance);

        await Should.ThrowAsync<AuthenticatedUserRequiredException>(
            () => handler.Handle(new SaveAmbientCredentialsCommand(ApiKey, ApplicationKey), CancellationToken.None));
    }
}
