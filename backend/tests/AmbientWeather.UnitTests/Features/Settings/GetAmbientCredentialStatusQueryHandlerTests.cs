using AmbientWeather.Application.Common;
using AmbientWeather.Application.Features.Settings.Queries;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.UnitTests.Common;
using Moq;
using Shouldly;

namespace AmbientWeather.UnitTests.Features.Settings;

public sealed class GetAmbientCredentialStatusQueryHandlerTests
{
    [Fact]
    public async Task HandleShouldReturnTrueWhenCredentialsExist()
    {
        var credentialStore = new Mock<IAmbientCredentialStore>();
        credentialStore
            .Setup(store => store.GetAsync(TestConstants.AuthProviderSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AmbientCredentials("api-key", "application-key"));
        var handler = new GetAmbientCredentialStatusQueryHandler(
            credentialStore.Object,
            CurrentUserServiceMockFactory.Create());

        var result = await handler.Handle(new GetAmbientCredentialStatusQuery(), CancellationToken.None);

        result.HasCredentials.ShouldBeTrue();
    }

    [Fact]
    public async Task HandleShouldReturnFalseWhenCredentialsAreMissing()
    {
        var credentialStore = new Mock<IAmbientCredentialStore>();
        credentialStore
            .Setup(store => store.GetAsync(TestConstants.AuthProviderSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AmbientCredentials?)null);
        var handler = new GetAmbientCredentialStatusQueryHandler(
            credentialStore.Object,
            CurrentUserServiceMockFactory.Create());

        var result = await handler.Handle(new GetAmbientCredentialStatusQuery(), CancellationToken.None);

        result.HasCredentials.ShouldBeFalse();
    }

    [Fact]
    public async Task HandleShouldThrowWhenUserIsNotAuthenticated()
    {
        var handler = new GetAmbientCredentialStatusQueryHandler(
            Mock.Of<IAmbientCredentialStore>(),
            CurrentUserServiceMockFactory.Create(isAuthenticated: false));

        await Should.ThrowAsync<AuthenticatedUserRequiredException>(
            () => handler.Handle(new GetAmbientCredentialStatusQuery(), CancellationToken.None));
    }
}
