using AmbientWeather.UnitTests.TestData;
using AmbientWeather.Application.DTOs.AmbientApi;
using AmbientWeather.Application.Features.Realtime;
using AmbientWeather.Domain.Entities;
using Shouldly;
using Xunit;

namespace AmbientWeather.UnitTests.Features.Realtime;

public class CurrentReadingMapperTests
{
    private static readonly WeatherStation Station = new()
    {
        MacAddress = WeatherTestData.Mac,
        Name = WeatherTestData.StationName,
        Nickname = "Back Patio",
    };

    private static readonly WeatherStation StationNoNickname = new()
    {
        MacAddress = WeatherTestData.Mac,
        Name = WeatherTestData.StationName,
    };

    private static readonly DateTime UtcNow = new(2026, 5, 31, 12, 0, 0, DateTimeKind.Utc);
    private static long EpochMs => new DateTimeOffset(UtcNow).ToUnixTimeMilliseconds();

    // -----------------------------------------------------------------------
    // FromWeatherReading
    // -----------------------------------------------------------------------

    [Fact]
    public void FromWeatherReadingShouldMapStationIdentityAndTimestamps()
    {
        var reading = new WeatherReadingDto { DateUtc = EpochMs };

        var result = CurrentReadingMapper.FromWeatherReading(reading, Station);

        result.DeviceId.ShouldBe(WeatherTestData.Mac);
        result.DeviceName.ShouldBe("Back Patio");
        result.TimestampUtc.ShouldBe(UtcNow);
        result.ReceivedAtUtc.ShouldBeGreaterThanOrEqualTo(result.TimestampUtc);
    }

    [Fact]
    public void FromWeatherReadingShouldFallBackToNameWhenNoNickname()
    {
        var reading = new WeatherReadingDto { DateUtc = EpochMs };

        var result = CurrentReadingMapper.FromWeatherReading(reading, StationNoNickname);

        result.DeviceName.ShouldBe(WeatherTestData.StationName);
    }

    [Fact]
    public void FromWeatherReadingShouldMapAllSensorFields()
    {
        var reading = new WeatherReadingDto
        {
            DateUtc = EpochMs,
            TempF = 72.4,
            TempInF = 68.0,
            FeelsLike = 74.0,
            FeelsLikeIn = 67.5,
            DewPoint = 55.1,
            DewPointIn = 50.0,
            Humidity = 62,
            HumidityIn = 45,
            BaromRelIn = 29.92,
            BaromAbsIn = 29.80,
            WindDir = 270,
            WindSpeedMph = 8.5,
            WindGustMph = 12.0,
            MaxDailyGust = 15.0,
            HourlyRainIn = 0.02,
            EventRainIn = 0.10,
            DailyRainIn = 0.25,
            WeeklyRainIn = 1.10,
            MonthlyRainIn = 3.50,
            YearlyRainIn = 18.75,
            TotalRainIn = 42.00,
            LastRain = new DateTime(2026, 5, 30, 18, 0, 0, DateTimeKind.Utc),
            SolarRadiation = 450.0,
            Uv = 5,
            Tz = "America/Chicago",
        };

        var result = CurrentReadingMapper.FromWeatherReading(reading, Station);

        result.TempF.ShouldBe(72.4);
        result.TempInF.ShouldBe(68.0);
        result.FeelsLike.ShouldBe(74.0);
        result.FeelsLikeIn.ShouldBe(67.5);
        result.DewPoint.ShouldBe(55.1);
        result.DewPointIn.ShouldBe(50.0);
        result.Humidity.ShouldBe(62);
        result.HumidityIn.ShouldBe(45);
        result.BaromRelIn.ShouldBe(29.92);
        result.BaromAbsIn.ShouldBe(29.80);
        result.WindDir.ShouldBe(270);
        result.WindSpeedMph.ShouldBe(8.5);
        result.WindGustMph.ShouldBe(12.0);
        result.MaxDailyGust.ShouldBe(15.0);
        result.HourlyRainIn.ShouldBe(0.02);
        result.EventRainIn.ShouldBe(0.10);
        result.DailyRainIn.ShouldBe(0.25);
        result.WeeklyRainIn.ShouldBe(1.10);
        result.MonthlyRainIn.ShouldBe(3.50);
        result.YearlyRainIn.ShouldBe(18.75);
        result.TotalRainIn.ShouldBe(42.00);
        result.LastRain.ShouldBe(new DateTime(2026, 5, 30, 18, 0, 0, DateTimeKind.Utc));
        result.SolarRadiation.ShouldBe(450.0);
        result.Uv.ShouldBe(5);
        result.Tz.ShouldBe("America/Chicago");
    }

    [Fact]
    public void FromWeatherReadingShouldProduceNullsForMissingSensorFields()
    {
        var reading = new WeatherReadingDto { DateUtc = EpochMs };

        var result = CurrentReadingMapper.FromWeatherReading(reading, Station);

        result.TempF.ShouldBeNull();
        result.Humidity.ShouldBeNull();
        result.WindSpeedMph.ShouldBeNull();
        result.DailyRainIn.ShouldBeNull();
        result.SolarRadiation.ShouldBeNull();
        result.Uv.ShouldBeNull();
        result.Tz.ShouldBeNull();
    }

    // -----------------------------------------------------------------------
    // FromDeviceData
    // -----------------------------------------------------------------------

    [Fact]
    public void FromDeviceDataShouldMapStationIdentityAndTimestamps()
    {
        var data = new DeviceDataDto { DateUtc = EpochMs };

        var result = CurrentReadingMapper.FromDeviceData(data, Station);

        result.DeviceId.ShouldBe(WeatherTestData.Mac);
        result.DeviceName.ShouldBe("Back Patio");
        result.TimestampUtc.ShouldBe(UtcNow);
        result.ReceivedAtUtc.ShouldBeGreaterThanOrEqualTo(result.TimestampUtc);
    }

    [Fact]
    public void FromDeviceDataShouldMapAllSensorFields()
    {
        var data = new DeviceDataDto
        {
            DateUtc = EpochMs,
            TempF = 71.0,
            TempInF = 69.0,
            Humidity = 58,
            HumidityIn = 42,
            BaromRelIn = 30.01,
            WindDir = 180,
            WindSpeedMph = 5.0,
            DailyRainIn = 0.0,
            SolarRadiation = 320.0,
            Uv = 3,
            Tz = "America/New_York",
        };

        var result = CurrentReadingMapper.FromDeviceData(data, Station);

        result.TempF.ShouldBe(71.0);
        result.TempInF.ShouldBe(69.0);
        result.Humidity.ShouldBe(58);
        result.HumidityIn.ShouldBe(42);
        result.BaromRelIn.ShouldBe(30.01);
        result.WindDir.ShouldBe(180);
        result.WindSpeedMph.ShouldBe(5.0);
        result.DailyRainIn.ShouldBe(0.0);
        result.SolarRadiation.ShouldBe(320.0);
        result.Uv.ShouldBe(3);
        result.Tz.ShouldBe("America/New_York");
    }

    [Fact]
    public void FromDeviceDataAndFromWeatherReadingShouldProduceEquivalentOutputForIdenticalPayloads()
    {
        var ts = EpochMs;
        var reading = new WeatherReadingDto
        {
            DateUtc = ts,
            TempF = 72.0,
            Humidity = 60,
            WindSpeedMph = 7.0,
        };
        var data = new DeviceDataDto
        {
            DateUtc = ts,
            TempF = 72.0,
            Humidity = 60,
            WindSpeedMph = 7.0,
        };

        var fromReading = CurrentReadingMapper.FromWeatherReading(reading, Station);
        var fromData = CurrentReadingMapper.FromDeviceData(data, Station);

        fromReading.TempF.ShouldBe(fromData.TempF);
        fromReading.Humidity.ShouldBe(fromData.Humidity);
        fromReading.WindSpeedMph.ShouldBe(fromData.WindSpeedMph);
        fromReading.DeviceId.ShouldBe(fromData.DeviceId);
        fromReading.TimestampUtc.ShouldBe(fromData.TimestampUtc);
    }
}
