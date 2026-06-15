using AmbientWeather.UnitTests.TestData;
using System.Text.Json;
using AmbientWeather.Application.DTOs.AmbientApi;
using AmbientWeather.Infrastructure.Ambient;
using Shouldly;

namespace AmbientWeather.UnitTests.Infrastructure.Ambient;

/// <summary>
/// Verifies that Ambient API JSON payloads deserialize correctly with <see cref="AmbientJsonOptions.Default"/>,
/// including numeric fields returned as strings and missing optional sensors.
/// </summary>
public class AmbientDtoDeserializationTests
{
    // Representative GET /v1/devices payload with a full sensor set.
    private static readonly string DevicesFixture = $$"""
        [
          {
            "macAddress": "{{WeatherTestData.ColonMac}}",
            "lastData": {
              "dateutc": 1718492399000,
              "tempf": 72.5,
              "tempinf": 68.1,
              "humidity": 55,
              "humidityin": 42,
              "baromrelin": 29.92,
              "baromabsin": 29.51,
              "windspeedmph": 5.4,
              "windgustmph": 8.1,
              "winddir": 270,
              "maxdailygust": 12.3,
              "hourlyrainin": 0.0,
              "eventrainin": 0.12,
              "dailyrainin": 0.25,
              "weeklyrainin": 1.10,
              "monthlyrainin": 3.45,
              "yearlyrainin": 18.90,
              "totalrainin": 102.30,
              "solarradiation": 450.2,
              "uv": 5,
              "feelsLike": 74.0,
              "dewPoint": 55.0,
              "feelsLikein": 68.5,
              "dewPointin": 50.0,
              "lastRain": "2024-06-15T10:30:00.000Z",
              "tz": "America/Chicago",
              "date": "2024-06-15T18:59:59.000Z"
            },
            "info": {
              "name": "My Station",
              "location": "Home"
            }
          }
        ]
        """;

    // GET /v1/devices payload with all optional sensors absent.
    private const string DevicesMinimalFixture = """
        [
          {
            "macAddress": "11:22:33:44:55:66",
            "lastData": {
              "dateutc": 1718492399000
            },
            "info": {
              "name": "Indoor Only"
            }
          }
        ]
        """;

    // History page where numeric fields are returned as JSON strings (observed in some firmware).
    private const string HistoryStringNumbersFixture = """
        [
          {
            "dateutc": "1718492399000",
            "tempf": "71.3",
            "humidity": "60",
            "baromrelin": "29.88",
            "windspeedmph": "3.2",
            "hourlyrainin": "0.00",
            "dailyrainin": "0.15",
            "weeklyrainin": "0.80",
            "monthlyrainin": "2.10",
            "yearlyrainin": "15.50",
            "solarradiation": "320.5",
            "uv": "3"
          }
        ]
        """;

    // History page with all sensor fields present and numeric types.
    private const string HistoryFullFixture = """
        [
          {
            "dateutc": 1718492399000,
            "tempf": 72.5,
            "tempinf": 68.1,
            "humidity": 55,
            "humidityin": 42,
            "baromrelin": 29.92,
            "baromabsin": 29.51,
            "windspeedmph": 5.4,
            "windgustmph": 8.1,
            "winddir": 270,
            "maxdailygust": 12.3,
            "hourlyrainin": 0.0,
            "eventrainin": 0.12,
            "dailyrainin": 0.25,
            "weeklyrainin": 1.10,
            "monthlyrainin": 3.45,
            "yearlyrainin": 18.90,
            "totalrainin": 102.30,
            "solarradiation": 450.2,
            "uv": 5,
            "feelsLike": 74.0,
            "dewPoint": 55.0,
            "tz": "America/Chicago",
            "date": "2024-06-15T18:59:59.000Z"
          }
        ]
        """;

    [Fact]
    public void DeviceDtoDeserializesFullFixture()
    {
        var devices = JsonSerializer.Deserialize<List<DeviceDto>>(DevicesFixture, AmbientJsonOptions.Default);

        devices.ShouldNotBeNull();
        devices.Count.ShouldBe(1);

        var device = devices[0];
        device.MacAddress.ShouldBe(WeatherTestData.ColonMac);

        var data = device.LastData;
        data.DateUtc.ShouldBe(1718492399000L);
        data.TempF.ShouldBe(72.5);
        data.TempInF.ShouldBe(68.1);
        data.Humidity.ShouldBe(55);
        data.HumidityIn.ShouldBe(42);
        data.BaromRelIn.ShouldBe(29.92);
        data.WindSpeedMph.ShouldBe(5.4);
        data.WindDir.ShouldBe(270);
        data.HourlyRainIn.ShouldBe(0.0);
        data.DailyRainIn.ShouldBe(0.25);
        data.WeeklyRainIn.ShouldBe(1.10);
        data.MonthlyRainIn.ShouldBe(3.45);
        data.YearlyRainIn.ShouldBe(18.90);
        data.TotalRainIn.ShouldBe(102.30);
        data.SolarRadiation.ShouldBe(450.2);
        data.Uv.ShouldBe(5);
        data.Tz.ShouldBe("America/Chicago");
    }

    [Fact]
    public void DeviceDtoDeserializesMinimalFixtureWithOptionalFieldsNull()
    {
        var devices = JsonSerializer.Deserialize<List<DeviceDto>>(DevicesMinimalFixture, AmbientJsonOptions.Default);

        devices.ShouldNotBeNull();
        var data = devices[0].LastData;
        data.TempF.ShouldBeNull();
        data.TempInF.ShouldBeNull();
        data.Humidity.ShouldBeNull();
        data.WindSpeedMph.ShouldBeNull();
        data.SolarRadiation.ShouldBeNull();
        data.Uv.ShouldBeNull();
        data.YearlyRainIn.ShouldBeNull();
    }

    [Fact]
    public void WeatherReadingDtoDeserializesFullHistoryFixture()
    {
        var readings = JsonSerializer.Deserialize<List<WeatherReadingDto>>(HistoryFullFixture, AmbientJsonOptions.Default);

        readings.ShouldNotBeNull();
        readings.Count.ShouldBe(1);

        var r = readings[0];
        r.DateUtc.ShouldBe(1718492399000L);
        r.TempF.ShouldBe(72.5);
        r.Humidity.ShouldBe(55);
        r.BaromRelIn.ShouldBe(29.92);
        r.WindSpeedMph.ShouldBe(5.4);
        r.WindDir.ShouldBe(270);
        r.HourlyRainIn.ShouldBe(0.0);
        r.DailyRainIn.ShouldBe(0.25);
        r.WeeklyRainIn.ShouldBe(1.10);
        r.MonthlyRainIn.ShouldBe(3.45);
        r.YearlyRainIn.ShouldBe(18.90);
        r.TotalRainIn.ShouldBe(102.30);
        r.SolarRadiation.ShouldBe(450.2);
        r.Uv.ShouldBe(5);
        r.Tz.ShouldBe("America/Chicago");
    }

    [Fact]
    public void WeatherReadingDtoDeserializesStringEncodedNumericFields()
    {
        var readings = JsonSerializer.Deserialize<List<WeatherReadingDto>>(HistoryStringNumbersFixture, AmbientJsonOptions.Default);

        readings.ShouldNotBeNull();
        var r = readings[0];

        r.DateUtc.ShouldBe(1718492399000L);
        r.TempF.ShouldBe(71.3);
        r.Humidity.ShouldBe(60);
        r.BaromRelIn.ShouldBe(29.88);
        r.WindSpeedMph.ShouldBe(3.2);
        r.HourlyRainIn.ShouldBe(0.00);
        r.DailyRainIn.ShouldBe(0.15);
        r.WeeklyRainIn.ShouldBe(0.80);
        r.MonthlyRainIn.ShouldBe(2.10);
        r.YearlyRainIn.ShouldBe(15.50);
        r.SolarRadiation.ShouldBe(320.5);
        r.Uv.ShouldBe(3);
    }

    [Fact]
    public void WeatherReadingDtoIgnoresUnknownFields()
    {
        const string Json = """
            [{ "dateutc": 1718492399000, "unknownFutureField": "ignored", "anotherUnknown": 42 }]
            """;

        var ex = Record.Exception(() =>
            JsonSerializer.Deserialize<List<WeatherReadingDto>>(Json, AmbientJsonOptions.Default));

        ex.ShouldBeNull();
    }

    [Fact]
    public void WeatherReadingDtoToleratesCaseVariation()
    {
        const string Json = """
            [{ "DateUtc": 1718492399000, "TempF": 70.0, "Humidity": 50 }]
            """;

        var readings = JsonSerializer.Deserialize<List<WeatherReadingDto>>(Json, AmbientJsonOptions.Default);

        readings.ShouldNotBeNull();
        readings[0].DateUtc.ShouldBe(1718492399000L);
        readings[0].TempF.ShouldBe(70.0);
        readings[0].Humidity.ShouldBe(50);
    }
}
