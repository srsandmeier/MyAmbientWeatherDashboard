using AmbientWeather.UnitTests.TestData;
using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.AmbientApi;
using AmbientWeather.Application.Features.DeviceHistory.Queries;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using Moq;
using Shouldly;

namespace AmbientWeather.UnitTests.Features.DeviceHistory;

public class GetDeviceHistoryQueryHandlerTests
{
    private const string Subject = "auth0|test-user";
    private static readonly string ValidMac = WeatherTestData.ColonMac;

    private readonly Mock<IDeviceHistoryService> _serviceMock = new();
    private readonly Mock<ICurrentUserService> _currentUserMock = new();
    private readonly Mock<IUserStationStore> _stationStoreMock = new();

    public GetDeviceHistoryQueryHandlerTests()
    {
        _currentUserMock.Setup(s => s.IsAuthenticated).Returns(true);
        _currentUserMock.Setup(s => s.AuthProviderSubject).Returns(Subject);
        _stationStoreMock
            .Setup(s => s.GetOwnedStationByMacAsync(Subject, ValidMac, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new WeatherStation { MacAddress = ValidMac, Name = WeatherTestData.StationName });
    }

    private GetDeviceHistoryQueryHandler CreateHandler() =>
        new(_serviceMock.Object, _currentUserMock.Object, _stationStoreMock.Object);

    [Fact]
    public async Task HandleShouldReturnDtoFromClient()
    {
        var expected = new DeviceHistoryResponseDto
        {
            Readings = [new WeatherReadingDto { DateUtc = 1000L, TempF = 72.5 }],
            TotalReadings = 1
        };

        _serviceMock
            .Setup(c => c.GetDeviceHistoryAsync(ValidMac, 288, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);

        var result = await CreateHandler().Handle(
            new GetDeviceHistoryQuery(ValidMac, 288, null), CancellationToken.None);

        result.ShouldBe(expected);
    }

    [Fact]
    public async Task HandleShouldReturnDtoWithEmptyReadingsWhenClientReturnsEmpty()
    {
        var empty = new DeviceHistoryResponseDto { Readings = [], TotalReadings = 0 };

        _serviceMock
            .Setup(c => c.GetDeviceHistoryAsync(ValidMac, 288, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(empty);

        var result = await CreateHandler().Handle(
            new GetDeviceHistoryQuery(ValidMac, 288, null), CancellationToken.None);

        result.Readings.ShouldBeEmpty();
    }

    [Fact]
    public async Task HandleShouldPropagateHttpRequestExceptionFromClient()
    {
        _serviceMock
            .Setup(c => c.GetDeviceHistoryAsync(ValidMac, 288, null, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new HttpRequestException("API unavailable"));

        await Should.ThrowAsync<HttpRequestException>(
            () => CreateHandler().Handle(
                new GetDeviceHistoryQuery(ValidMac, 288, null), CancellationToken.None));
    }

    [Fact]
    public async Task HandleShouldThrowNotFoundWhenStationNotOwnedByUser()
    {
        _stationStoreMock
            .Setup(s => s.GetOwnedStationByMacAsync(Subject, ValidMac, It.IsAny<CancellationToken>()))
            .ReturnsAsync((WeatherStation?)null);

        await Should.ThrowAsync<AmbientApiNotFoundException>(
            () => CreateHandler().Handle(
                new GetDeviceHistoryQuery(ValidMac, 288, null), CancellationToken.None));

        _serviceMock.Verify(
            s => s.GetDeviceHistoryAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task HandleShouldThrowWhenUserNotAuthenticated()
    {
        _currentUserMock.Setup(s => s.IsAuthenticated).Returns(false);
        _currentUserMock.Setup(s => s.AuthProviderSubject).Returns((string?)null);

        await Should.ThrowAsync<AuthenticatedUserRequiredException>(
            () => CreateHandler().Handle(
                new GetDeviceHistoryQuery(ValidMac, 288, null), CancellationToken.None));
    }
}
