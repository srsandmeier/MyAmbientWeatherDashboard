using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.Alerts;
using AmbientWeather.Application.Features.Alerts.Queries;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using AmbientWeather.UnitTests.Common;
using Bogus;
using Moq;
using Shouldly;

namespace AmbientWeather.UnitTests.Features.Alerts;

public sealed class GetActiveAlertsQueryHandlerTests
{
    private static readonly Faker F = new();

    [Fact]
    public async Task HandleShouldReturnEmptyWhenDefaultStationHasNoCoordinates()
    {
        var stationStore = new Mock<IUserStationStore>();
        stationStore
            .Setup(s => s.GetDefaultStationAsync(TestConstants.AuthProviderSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new WeatherStation { MacAddress = F.Random.Hexadecimal(12, string.Empty) });
        var alertService = new Mock<IWeatherAlertService>();
        var handler = new GetActiveAlertsQueryHandler(
            CurrentUserServiceMockFactory.Create(),
            stationStore.Object,
            alertService.Object);

        var result = await handler.Handle(new GetActiveAlertsQuery(), CancellationToken.None);

        result.ShouldBeEmpty();
        alertService.Verify(
            s => s.GetActiveAlertsAsync(It.IsAny<string>(), It.IsAny<double>(), It.IsAny<double>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task HandleShouldFetchAlertsForDefaultStationCoordinates()
    {
        var station = CreateStationWithCoordinates();
        var latitude = station.Latitude.GetValueOrDefault();
        var longitude = station.Longitude.GetValueOrDefault();
        var alert = new WeatherAlertDto { Id = F.Random.AlphaNumeric(12), Event = $"Generated event {F.Random.AlphaNumeric(4)}" };
        var stationStore = new Mock<IUserStationStore>();
        stationStore
            .Setup(s => s.GetDefaultStationAsync(TestConstants.AuthProviderSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(station);
        var alertService = new Mock<IWeatherAlertService>();
        alertService
            .Setup(s => s.GetActiveAlertsAsync(
                It.IsAny<string>(),
                latitude,
                longitude,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync([alert]);
        var handler = new GetActiveAlertsQueryHandler(
            CurrentUserServiceMockFactory.Create(),
            stationStore.Object,
            alertService.Object);

        var result = await handler.Handle(new GetActiveAlertsQuery(), CancellationToken.None);

        result.ShouldBe([alert]);
    }

    [Fact]
    public async Task HandleShouldFetchAlertsForSelectedArea()
    {
        var areaCode = F.Address.StateAbbr();
        var alert = new WeatherAlertDto { Id = F.Random.AlphaNumeric(12), Event = $"Generated event {F.Random.AlphaNumeric(4)}" };
        var stationStore = new Mock<IUserStationStore>();
        var alertService = new Mock<IWeatherAlertService>();
        alertService
            .Setup(s => s.GetActiveAlertsForAreaAsync(
                It.IsAny<string>(),
                areaCode,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync([alert]);
        var handler = new GetActiveAlertsQueryHandler(
            CurrentUserServiceMockFactory.Create(),
            stationStore.Object,
            alertService.Object);

        var result = await handler.Handle(new GetActiveAlertsQuery(areaCode), CancellationToken.None);

        result.ShouldBe([alert]);
        stationStore.Verify(
            s => s.GetDefaultStationAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }


    [Fact]
    public async Task HandleShouldThrowWhenUserIsNotAuthenticated()
    {
        var handler = new GetActiveAlertsQueryHandler(
            CurrentUserServiceMockFactory.Create(isAuthenticated: false),
            Mock.Of<IUserStationStore>(),
            Mock.Of<IWeatherAlertService>());

        await Should.ThrowAsync<AuthenticatedUserRequiredException>(
            () => handler.Handle(new GetActiveAlertsQuery(), CancellationToken.None));
    }

    private static WeatherStation CreateStationWithCoordinates() => new()
    {
        MacAddress = F.Random.Hexadecimal(12, string.Empty),
        Latitude = F.Random.Double(18, 71),
        Longitude = F.Random.Double(-179, -61),
    };
}
