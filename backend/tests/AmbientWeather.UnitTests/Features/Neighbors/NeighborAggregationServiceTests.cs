using AmbientWeather.Domain.Neighbors;
using AmbientWeather.Infrastructure.Neighbors;
using Bogus;
using Shouldly;
using Xunit;

namespace AmbientWeather.UnitTests.Features.Neighbors;

public sealed class NeighborAggregationServiceTests
{
    private static readonly NeighborAggregationService Service = new();

    private static readonly Faker F = new();

    private static NeighborStation MakeStation(
        double? tempF = 70.0,
        int? humidity = 50,
        int? windDir = null,
        double? windSpeedMph = null,
        double? dailyHighTempF = null,
        double? dailyLowTempF = null) => new()
        {
            Provider = "WeatherGov",
            SourceId = Guid.NewGuid().ToString(),
            Lat = F.Address.Latitude(),
            Lon = F.Address.Longitude(),
            DistanceMiles = 5.0,
            TempF = tempF,
            Humidity = humidity,
            WindDir = windDir,
            WindSpeedMph = windSpeedMph,
            DailyHighTempF = dailyHighTempF,
            DailyLowTempF = dailyLowTempF,
        };

    // -----------------------------------------------------------------------
    // Empty input
    // -----------------------------------------------------------------------

    [Fact]
    public void EmptyListShouldReturnAllNullsAndBelowMin()
    {
        var result = Service.Aggregate([], minStations: 3);

        result.TempF.ShouldBeNull();
        result.Humidity.ShouldBeNull();
        result.ContributingStationCount.ShouldBe(0);
        result.IsBelowMinStations.ShouldBeTrue();
    }

    // -----------------------------------------------------------------------
    // Mean aggregation
    // -----------------------------------------------------------------------

    [Fact]
    public void TwoStationsShouldAverageTempCorrectly()
    {
        var stations = new[] { MakeStation(tempF: 60.0), MakeStation(tempF: 80.0) };

        var result = Service.Aggregate(stations, minStations: 2);

        result.TempF.ShouldBe(70.0);
        result.ContributingStationCount.ShouldBe(2);
    }

    [Fact]
    public void NullSensorValueShouldBeExcludedFromMean()
    {
        // Station A has a temp, station B does not — mean should use only A.
        var stations = new[] { MakeStation(tempF: 72.0), MakeStation(tempF: null) };

        var result = Service.Aggregate(stations, minStations: 2);

        result.TempF.ShouldBe(72.0);
    }

    [Fact]
    public void AllNullSensorValuesShouldReturnNull()
    {
        var stations = new[] { MakeStation(tempF: null), MakeStation(tempF: null) };

        var result = Service.Aggregate(stations, minStations: 2);

        result.TempF.ShouldBeNull();
    }

    // -----------------------------------------------------------------------
    // Min-stations flag
    // -----------------------------------------------------------------------

    [Fact]
    public void CountBelowMinStationsShouldSetFlag()
    {
        var stations = new[] { MakeStation() };

        var result = Service.Aggregate(stations, minStations: 3);

        result.IsBelowMinStations.ShouldBeTrue();
        result.ContributingStationCount.ShouldBe(1);
    }

    [Fact]
    public void CountMeetingMinStationsShouldClearFlag()
    {
        var stations = new[] { MakeStation(), MakeStation(), MakeStation() };

        var result = Service.Aggregate(stations, minStations: 3);

        result.IsBelowMinStations.ShouldBeFalse();
        result.ContributingStationCount.ShouldBe(3);
    }

    // -----------------------------------------------------------------------
    // Circular wind direction mean
    // -----------------------------------------------------------------------

    [Fact]
    public void WindDirAroundNorthShouldCircularAvgCorrectly()
    {
        // 350° and 10° should average to ~0° (north), not 180° (south).
        var stations = new[]
        {
            MakeStation(windDir: 350),
            MakeStation(windDir: 10),
        };

        var result = Service.Aggregate(stations, minStations: 2);

        // Circular mean of 350° and 10° is 0° (±1° for rounding).
        result.WindDir.ShouldNotBeNull();
        var dir = result.WindDir!.Value;
        (dir <= 1 || dir >= 359).ShouldBeTrue($"Expected ~0°, got {dir}°");
    }

    [Fact]
    public void WindDirAllNullShouldReturnNull()
    {
        var stations = new[] { MakeStation(windDir: null), MakeStation(windDir: null) };

        var result = Service.Aggregate(stations, minStations: 2);

        result.WindDir.ShouldBeNull();
    }

    // -----------------------------------------------------------------------
    // Daily extremes aggregation
    // -----------------------------------------------------------------------

    [Fact]
    public void DailyHighTempShouldBeMaxAcrossStations()
    {
        var stations = new[]
        {
            MakeStation(dailyHighTempF: 85.0),
            MakeStation(dailyHighTempF: 92.0),
            MakeStation(dailyHighTempF: 78.0),
        };

        var result = Service.Aggregate(stations, minStations: 3);

        result.DailyHighTempF.ShouldBe(92.0);
    }

    [Fact]
    public void DailyLowTempShouldBeMinAcrossStations()
    {
        var stations = new[]
        {
            MakeStation(dailyLowTempF: 55.0),
            MakeStation(dailyLowTempF: 48.0),
            MakeStation(dailyLowTempF: 61.0),
        };

        var result = Service.Aggregate(stations, minStations: 3);

        result.DailyLowTempF.ShouldBe(48.0);
    }

    [Fact]
    public void DailyExtremesShouldExcludeNullValues()
    {
        var stations = new[]
        {
            MakeStation(dailyHighTempF: 88.0, dailyLowTempF: 52.0),
            MakeStation(dailyHighTempF: null, dailyLowTempF: null),
        };

        var result = Service.Aggregate(stations, minStations: 2);

        result.DailyHighTempF.ShouldBe(88.0);
        result.DailyLowTempF.ShouldBe(52.0);
    }

    [Fact]
    public void DailyExtremesAllNullShouldReturnNull()
    {
        var stations = new[]
        {
            MakeStation(dailyHighTempF: null, dailyLowTempF: null),
            MakeStation(dailyHighTempF: null, dailyLowTempF: null),
        };

        var result = Service.Aggregate(stations, minStations: 2);

        result.DailyHighTempF.ShouldBeNull();
        result.DailyLowTempF.ShouldBeNull();
    }
}
