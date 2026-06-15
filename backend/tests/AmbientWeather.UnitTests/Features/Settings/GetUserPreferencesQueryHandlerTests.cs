using AmbientWeather.Application.Common;
using AmbientWeather.Application.Features.Settings.Queries;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using AmbientWeather.UnitTests.Common;
using Moq;
using Shouldly;

namespace AmbientWeather.UnitTests.Features.Settings;

public sealed class GetUserPreferencesQueryHandlerTests
{
    [Fact]
    public async Task HandleShouldReturnDefaultPreferencesWhenNoneStoredYet()
    {
        var store = new Mock<IUserPreferencesStore>();
        store
            .Setup(s => s.GetOrCreateAsync(TestConstants.AuthProviderSubject, TestConstants.Email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserPreferences());
        var handler = new GetUserPreferencesQueryHandler(store.Object, CurrentUserServiceMockFactory.Create());

        var result = await handler.Handle(new GetUserPreferencesQuery(), CancellationToken.None);

        result.ShouldNotBeNull();
        result.TemperatureUnit.ShouldBe("F");
        result.SpeedUnit.ShouldBe("mph");
        result.Theme.ShouldBe("system");
        result.DateFormat.ShouldBe("mdy");
    }

    [Fact]
    public async Task HandleShouldReturnStoredPreferences()
    {
        var stored = new UserPreferences { TemperatureUnit = "C", SpeedUnit = "kmh", Theme = "dark", DateFormat = "iso", PressureUnit = "hpa", RainfallUnit = "mm", DistanceUnit = "km" };
        var store = new Mock<IUserPreferencesStore>();
        store
            .Setup(s => s.GetOrCreateAsync(TestConstants.AuthProviderSubject, TestConstants.Email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(stored);
        var handler = new GetUserPreferencesQueryHandler(store.Object, CurrentUserServiceMockFactory.Create());

        var result = await handler.Handle(new GetUserPreferencesQuery(), CancellationToken.None);

        result.TemperatureUnit.ShouldBe("C");
        result.SpeedUnit.ShouldBe("kmh");
        result.Theme.ShouldBe("dark");
        result.DateFormat.ShouldBe("iso");
    }

    [Fact]
    public async Task HandleShouldThrowWhenUserIsNotAuthenticated()
    {
        var handler = new GetUserPreferencesQueryHandler(
            Mock.Of<IUserPreferencesStore>(),
            CurrentUserServiceMockFactory.Create(isAuthenticated: false));

        await Should.ThrowAsync<AuthenticatedUserRequiredException>(
            () => handler.Handle(new GetUserPreferencesQuery(), CancellationToken.None));
    }
}
