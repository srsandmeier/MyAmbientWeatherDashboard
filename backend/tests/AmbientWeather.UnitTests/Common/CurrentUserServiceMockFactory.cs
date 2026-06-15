using AmbientWeather.Application.Interfaces;
using Moq;

namespace AmbientWeather.UnitTests.Common;

/// <summary>
/// Factory for creating <see cref="ICurrentUserService"/> mocks with standard test identity.
/// </summary>
internal static class CurrentUserServiceMockFactory
{
    /// <summary>
    /// Creates an authenticated mock with the shared test subject and email.
    /// Pass <paramref name="isAuthenticated"/>=false to simulate an unauthenticated request.
    /// </summary>
    internal static ICurrentUserService Create(bool isAuthenticated = true)
    {
        var mock = new Mock<ICurrentUserService>();
        mock.SetupGet(s => s.IsAuthenticated).Returns(isAuthenticated);
        mock.SetupGet(s => s.AuthProviderSubject).Returns(TestConstants.AuthProviderSubject);
        mock.SetupGet(s => s.Email).Returns(TestConstants.Email);
        return mock.Object;
    }
}
