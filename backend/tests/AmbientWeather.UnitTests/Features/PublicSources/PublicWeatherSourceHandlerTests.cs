using AmbientWeather.Application.Common;
using AmbientWeather.Application.Features.PublicSources;
using AmbientWeather.Application.Features.PublicSources.Commands;
using AmbientWeather.Application.Features.PublicSources.Queries;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Application.DTOs.Realtime;
using AmbientWeather.Domain.Entities;
using AmbientWeather.UnitTests.Common;
using AmbientWeather.UnitTests.TestData;
using Bogus;
using Moq;
using Shouldly;

namespace AmbientWeather.UnitTests.Features.PublicSources;

public sealed class PublicWeatherSourceHandlerTests
{
    private static readonly Faker F = new();

    [Fact]
    public async Task GetReturnsUserSources()
    {
        var source = CreateSource();
        var store = new Mock<IPublicWeatherSourceStore>();
        store
            .Setup(s => s.GetAllAsync(TestConstants.AuthProviderSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync([source]);
        var handler = new GetPublicWeatherSourcesQueryHandler(store.Object, CurrentUserServiceMockFactory.Create());

        var result = await handler.Handle(new GetPublicWeatherSourcesQuery(), CancellationToken.None);

        result.Count.ShouldBe(1);
        result[0].SourceId.ShouldBe(source.SourceId);
    }

    [Fact]
    public async Task CreateAddsSourceForCurrentUser()
    {
        var store = new Mock<IPublicWeatherSourceStore>();
        store
            .Setup(s => s.AddAsync(
                TestConstants.AuthProviderSubject,
                TestConstants.Email,
                It.IsAny<PublicWeatherSource>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((string _, string? _, PublicWeatherSource source, CancellationToken _) => source);
        var handler = new CreatePublicWeatherSourceCommandHandler(store.Object, CurrentUserServiceMockFactory.Create());
        var command = new CreatePublicWeatherSourceCommand(
            PublicWeatherSourceProviders.OpenMeteo,
            WeatherTestData.SourceId,
            $"Generated source {F.Random.AlphaNumeric(4)}",
            F.Address.Latitude(),
            F.Address.Longitude(),
            null,
            true);

        var result = await handler.Handle(command, CancellationToken.None);

        result.Provider.ShouldBe(PublicWeatherSourceProviders.OpenMeteo);
        result.SourceId.ShouldBe(command.SourceId);
        store.Verify(
            s => s.AddAsync(
                TestConstants.AuthProviderSubject,
                TestConstants.Email,
                It.Is<PublicWeatherSource>(source => source.Timezone == null && source.IsEnabled),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task UpdateThrowsNotFoundWhenSourceIsNotOwned()
    {
        var store = new Mock<IPublicWeatherSourceStore>();
        store
            .Setup(s => s.GetByIdAsync(TestConstants.AuthProviderSubject, It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((PublicWeatherSource?)null);
        var handler = new UpdatePublicWeatherSourceCommandHandler(store.Object, CurrentUserServiceMockFactory.Create());

        await Should.ThrowAsync<AmbientApiNotFoundException>(
            () => handler.Handle(new UpdatePublicWeatherSourceCommand(Guid.NewGuid(), "Updated", null), CancellationToken.None));
    }

    [Fact]
    public async Task UpdateSavesChangedFields()
    {
        var source = CreateSource();
        var store = new Mock<IPublicWeatherSourceStore>();
        store
            .Setup(s => s.GetByIdAsync(TestConstants.AuthProviderSubject, source.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(source);
        var handler = new UpdatePublicWeatherSourceCommandHandler(store.Object, CurrentUserServiceMockFactory.Create());
        var label = $"Generated source {F.Random.AlphaNumeric(4)}";

        var result = await handler.Handle(new UpdatePublicWeatherSourceCommand(source.Id, label, false), CancellationToken.None);

        result.DisplayLabel.ShouldBe(label);
        result.IsEnabled.ShouldBeFalse();
        store.Verify(s => s.SaveAsync(source, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdateSavesSelectedMetricKeys()
    {
        var source = CreateSource();
        var store = new Mock<IPublicWeatherSourceStore>();
        store
            .Setup(s => s.GetByIdAsync(TestConstants.AuthProviderSubject, source.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(source);
        var handler = new UpdatePublicWeatherSourceCommandHandler(store.Object, CurrentUserServiceMockFactory.Create());

        var result = await handler.Handle(
            new UpdatePublicWeatherSourceCommand(source.Id, null, null, ["outdoor_temp", "wind_speed"]),
            CancellationToken.None);

        result.SelectedMetricKeys.ShouldNotBeNull();
        result.SelectedMetricKeys.ShouldBe(["outdoor_temp", "wind_speed"]);
        source.SelectedMetricKeysJson.ShouldNotBeNull();
        source.SelectedMetricKeysJson.ShouldContain("outdoor_temp");
        store.Verify(s => s.SaveAsync(source, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeleteRemovesOwnedSource()
    {
        var source = CreateSource();
        var store = new Mock<IPublicWeatherSourceStore>();
        store
            .Setup(s => s.GetByIdAsync(TestConstants.AuthProviderSubject, source.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(source);
        var handler = new DeletePublicWeatherSourceCommandHandler(store.Object, CurrentUserServiceMockFactory.Create());

        await handler.Handle(new DeletePublicWeatherSourceCommand(source.Id), CancellationToken.None);

        store.Verify(s => s.DeleteAsync(source, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetCurrentReadingReturnsOwnedPublicSourceReading()
    {
        var source = CreateSource();
        var reading = new CurrentReadingDto
        {
            DeviceId = $"public:{source.Id}",
            DeviceName = source.DisplayLabel,
            TimestampUtc = DateTime.UtcNow,
            ReceivedAtUtc = DateTime.UtcNow,
            Source = "public",
            TempF = F.Random.Double(10, 100),
        };
        var store = new Mock<IPublicWeatherSourceStore>();
        store
            .Setup(s => s.GetByIdAsync(TestConstants.AuthProviderSubject, source.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(source);
        var currentService = new Mock<IPublicSourceCurrentReadingService>();
        currentService
            .Setup(s => s.GetCurrentAsync(It.IsAny<string>(), source, It.IsAny<CancellationToken>()))
            .ReturnsAsync(reading);
        var handler = new GetPublicSourceCurrentReadingQueryHandler(
            CurrentUserServiceMockFactory.Create(),
            store.Object,
            currentService.Object);

        var result = await handler.Handle(new GetPublicSourceCurrentReadingQuery(source.Id), CancellationToken.None);

        result.ShouldBe(reading);
    }

    [Fact]
    public async Task GetThrowsWhenUserIsNotAuthenticated()
    {
        var handler = new GetPublicWeatherSourcesQueryHandler(
            Mock.Of<IPublicWeatherSourceStore>(),
            CurrentUserServiceMockFactory.Create(isAuthenticated: false));

        await Should.ThrowAsync<AuthenticatedUserRequiredException>(
            () => handler.Handle(new GetPublicWeatherSourcesQuery(), CancellationToken.None));
    }

    private static PublicWeatherSource CreateSource() => new()
    {
        Id = Guid.NewGuid(),
        Provider = PublicWeatherSourceProviders.WeatherGov,
        SourceId = WeatherTestData.SourceId,
        DisplayLabel = $"Generated source {F.Random.AlphaNumeric(4)}",
        Latitude = F.Address.Latitude(),
        Longitude = F.Address.Longitude(),
        IsEnabled = true,
    };
}
