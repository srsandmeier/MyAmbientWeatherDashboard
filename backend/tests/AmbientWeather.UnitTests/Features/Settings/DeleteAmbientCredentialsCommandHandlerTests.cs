using AmbientWeather.Application.Common;
using AmbientWeather.Application.Features.Settings.Commands;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.UnitTests.Common;
using Moq;
using Shouldly;

namespace AmbientWeather.UnitTests.Features.Settings;

public sealed class DeleteAmbientCredentialsCommandHandlerTests
{
    [Fact]
    public async Task HandleShouldDeleteCredentialsForCurrentUser()
    {
        var credentialStore = new Mock<IAmbientCredentialStore>();
        var historyService = new Mock<IDeviceHistoryService>();
        var realtimeRegistry = new Mock<IRealtimeSubscriptionRegistry>();
        var handler = new DeleteAmbientCredentialsCommandHandler(
            credentialStore.Object,
            historyService.Object,
            CurrentUserServiceMockFactory.Create(),
            realtimeRegistry.Object);

        await handler.Handle(new DeleteAmbientCredentialsCommand(), CancellationToken.None);

        credentialStore.Verify(
            store => store.DeleteAsync(TestConstants.AuthProviderSubject, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task HandleShouldInvalidateHistoryCacheAfterDeletingCredentials()
    {
        var credentialStore = new Mock<IAmbientCredentialStore>();
        var historyService = new Mock<IDeviceHistoryService>();
        var realtimeRegistry = new Mock<IRealtimeSubscriptionRegistry>();
        var handler = new DeleteAmbientCredentialsCommandHandler(
            credentialStore.Object,
            historyService.Object,
            CurrentUserServiceMockFactory.Create(),
            realtimeRegistry.Object);

        await handler.Handle(new DeleteAmbientCredentialsCommand(), CancellationToken.None);

        historyService.Verify(
            s => s.InvalidateAllCachesAsync(It.IsAny<CancellationToken>()),
            Times.Once);
        realtimeRegistry.Verify(
            registry => registry.InvalidateAsync(TestConstants.AuthProviderSubject, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task HandleShouldThrowWhenUserIsNotAuthenticated()
    {
        var handler = new DeleteAmbientCredentialsCommandHandler(
            Mock.Of<IAmbientCredentialStore>(),
            Mock.Of<IDeviceHistoryService>(),
            CurrentUserServiceMockFactory.Create(isAuthenticated: false),
            Mock.Of<IRealtimeSubscriptionRegistry>());

        await Should.ThrowAsync<AuthenticatedUserRequiredException>(
            () => handler.Handle(new DeleteAmbientCredentialsCommand(), CancellationToken.None));
    }
}
