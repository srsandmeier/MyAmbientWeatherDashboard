using AmbientWeather.Application.Common;
using AmbientWeather.Application.Features.Neighbors.Queries;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using AmbientWeather.Domain.Neighbors;
using Bogus;
using Moq;
using Shouldly;
using Xunit;

namespace AmbientWeather.UnitTests.Features.Neighbors;

public sealed class GetPinnedStationReadingQueryHandlerTests
{
    private const string Subject = "auth0|test-user";
    private const string Provider = "WeatherGov";
    private const string SourceId = "KORD";

    private static readonly Faker F = new();

    private readonly Mock<ICurrentUserService> _currentUserMock = new();
    private readonly Mock<IUserPreferencesStore> _prefStoreMock = new();
    private readonly Mock<IUserStationStore> _stationStoreMock = new();
    private readonly Mock<INeighborDiscoveryService> _discoveryMock = new();

    private GetPinnedStationReadingQueryHandler CreateHandler() =>
        new(_currentUserMock.Object, _prefStoreMock.Object, _stationStoreMock.Object, _discoveryMock.Object);

    private void SetupAuthenticatedUser()
    {
        _currentUserMock.SetupGet(s => s.IsAuthenticated).Returns(true);
        _currentUserMock.SetupGet(s => s.AuthProviderSubject).Returns(Subject);
        _currentUserMock.SetupGet(s => s.Email).Returns("test@example.com");
    }

    private void SetupNeighborsEnabled()
    {
        _prefStoreMock
            .Setup(s => s.GetOrCreateAsync(Subject, It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserPreferences
            {
                NeighborConfigJson = """{"isEnabled":true,"radiusMiles":25,"maxAgeMinutes":60,"minStations":1}""",
            });
    }

    private void SetupCachedStation(NeighborStation station)
    {
        var hash = UserSegmentHash.Compute(Subject);
        _discoveryMock
            .Setup(s => s.GetCachedStationAsync(hash, Provider, SourceId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(station);
    }

    private void SetupNoCachedStation()
    {
        var hash = UserSegmentHash.Compute(Subject);
        _discoveryMock
            .Setup(s => s.GetCachedStationAsync(hash, Provider, SourceId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((NeighborStation?)null);
    }

    [Fact]
    public async Task DailyHighAndLowArePassedThroughToDto()
    {
        SetupAuthenticatedUser();
        SetupNeighborsEnabled();
        SetupCachedStation(new NeighborStation
        {
            Provider = Provider,
            SourceId = SourceId,
            Lat = F.Address.Latitude(),
            Lon = F.Address.Longitude(),
            DistanceMiles = 3.0,
            TempF = 72.0,
            DailyHighTempF = 88.5,
            DailyLowTempF = 61.2,
        });

        var result = await CreateHandler().Handle(
            new GetPinnedStationReadingQuery(Provider, SourceId),
            CancellationToken.None);

        result.DailyHighTempF.ShouldBe(88.5);
        result.DailyLowTempF.ShouldBe(61.2);
    }

    [Fact]
    public async Task NwsTextFieldsArePassedThroughToDto()
    {
        SetupAuthenticatedUser();
        SetupNeighborsEnabled();
        SetupCachedStation(new NeighborStation
        {
            Provider = Provider,
            SourceId = SourceId,
            Lat = F.Address.Latitude(),
            Lon = F.Address.Longitude(),
            DistanceMiles = 3.0,
            TempF = 72.0,
            SkyConditions = "FEW @ 1,800ft",
            PresentWeather = "Light Rain",
            TextDescription = "Partly cloudy with light rain.",
            RawMetar = "KORD 091753Z 18015KT 10SM -RA FEW018 22/14 A2992",
        });

        var result = await CreateHandler().Handle(
            new GetPinnedStationReadingQuery(Provider, SourceId),
            CancellationToken.None);

        result.NwsSkyConditions.ShouldBe("FEW @ 1,800ft");
        result.NwsPresentWeather.ShouldBe("Light Rain");
        result.NwsTextDescription.ShouldBe("Partly cloudy with light rain.");
        result.NwsRawMetar.ShouldBe("KORD 091753Z 18015KT 10SM -RA FEW018 22/14 A2992");
    }

    [Fact]
    public async Task NullDailyExtremesProduceNullInDto()
    {
        SetupAuthenticatedUser();
        SetupNeighborsEnabled();
        SetupCachedStation(new NeighborStation
        {
            Provider = Provider,
            SourceId = SourceId,
            Lat = F.Address.Latitude(),
            Lon = F.Address.Longitude(),
            DistanceMiles = 3.0,
            TempF = 72.0,
            DailyHighTempF = null,
            DailyLowTempF = null,
        });

        var result = await CreateHandler().Handle(
            new GetPinnedStationReadingQuery(Provider, SourceId),
            CancellationToken.None);

        result.DailyHighTempF.ShouldBeNull();
        result.DailyLowTempF.ShouldBeNull();
    }

    [Fact]
    public async Task CacheMissDiscoversStationsBeforeReturningNotFound()
    {
        SetupAuthenticatedUser();
        SetupNeighborsEnabled();
        SetupNoCachedStation();

        var lat = F.Address.Latitude();
        var lon = F.Address.Longitude();
        var hash = UserSegmentHash.Compute(Subject);
        var discovered = new NeighborStation
        {
            Provider = Provider,
            SourceId = SourceId,
            Name = "Generated pinned station",
            Lat = lat,
            Lon = lon,
            DistanceMiles = 3.0,
            TempF = 68.4,
        };

        _stationStoreMock
            .Setup(s => s.GetDefaultStationAsync(Subject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new WeatherStation
            {
                MacAddress = "F4CFA2AAAAAA",
                Latitude = lat,
                Longitude = lon,
            });
        _discoveryMock
            .Setup(s => s.GetOrDiscoverAsync(
                hash,
                It.Is<NeighborConfig>(c => c.UserLatitude == lat && c.UserLongitude == lon),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync([discovered]);

        var result = await CreateHandler().Handle(
            new GetPinnedStationReadingQuery(Provider, SourceId),
            CancellationToken.None);

        result.TempF.ShouldBe(68.4);
        result.DeviceName.ShouldBe("Generated pinned station");
    }
}
