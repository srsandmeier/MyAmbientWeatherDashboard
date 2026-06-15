using AmbientWeather.Application.Common;
using AmbientWeather.Application.Features.Settings.Commands;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using AmbientWeather.UnitTests.Common;
using Moq;
using Shouldly;

namespace AmbientWeather.UnitTests.Features.Settings;

public sealed class UpdateUserPreferencesCommandHandlerTests
{
    private static readonly UpdateUserPreferencesCommand DefaultCommand = new("C", "kmh", "hpa", "mm", "km", "dark", "iso", 1, "utc");

    [Fact]
    public async Task HandleShouldUpdateAndSavePreferences()
    {
        var stored = new UserPreferences();
        var store = new Mock<IUserPreferencesStore>();
        store
            .Setup(s => s.GetOrCreateAsync(TestConstants.AuthProviderSubject, TestConstants.Email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(stored);
        var handler = new UpdateUserPreferencesCommandHandler(store.Object, CurrentUserServiceMockFactory.Create());

        var result = await handler.Handle(DefaultCommand, CancellationToken.None);

        result.TemperatureUnit.ShouldBe("C");
        result.SpeedUnit.ShouldBe("kmh");
        result.PressureUnit.ShouldBe("hpa");
        result.RainfallUnit.ShouldBe("mm");
        result.DistanceUnit.ShouldBe("km");
        result.Theme.ShouldBe("dark");
        result.DateFormat.ShouldBe("iso");

        store.Verify(s => s.SaveAsync(stored, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task HandleShouldReturnUpdatedDtoReflectingNewValues()
    {
        var store = new Mock<IUserPreferencesStore>();
        store
            .Setup(s => s.GetOrCreateAsync(TestConstants.AuthProviderSubject, TestConstants.Email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserPreferences());
        var handler = new UpdateUserPreferencesCommandHandler(store.Object, CurrentUserServiceMockFactory.Create());

        var result = await handler.Handle(new UpdateUserPreferencesCommand("F", "mph", "inhg", "in", "mi", "light", "dmy", 2, "local"), CancellationToken.None);

        result.TemperatureUnit.ShouldBe("F");
        result.Theme.ShouldBe("light");
        result.DateFormat.ShouldBe("dmy");
    }

    [Fact]
    public async Task HandleShouldThrowWhenUserIsNotAuthenticated()
    {
        var handler = new UpdateUserPreferencesCommandHandler(
            Mock.Of<IUserPreferencesStore>(),
            CurrentUserServiceMockFactory.Create(isAuthenticated: false));

        await Should.ThrowAsync<AuthenticatedUserRequiredException>(
            () => handler.Handle(DefaultCommand, CancellationToken.None));
    }
}
