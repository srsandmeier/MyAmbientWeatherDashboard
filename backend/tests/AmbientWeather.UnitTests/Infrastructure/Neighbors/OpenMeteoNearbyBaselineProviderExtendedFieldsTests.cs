using System.Net;
using System.Text;
using AmbientWeather.Domain.Neighbors;
using AmbientWeather.Infrastructure.Neighbors;
using Bogus;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;
using Xunit;

namespace AmbientWeather.UnitTests.Infrastructure.Neighbors;

/// <summary>
/// Verifies that <see cref="OpenMeteoNearbyBaselineProvider"/> maps the Open-Meteo
/// extended current and daily fields to the corresponding <see cref="NeighborStation"/>
/// properties introduced in Slice 12.4.
/// </summary>
public sealed class OpenMeteoNearbyBaselineProviderExtendedFieldsTests
{
    [Fact]
    public async Task CurrentExtendedFieldsAreMapped()
    {
        var stations = await DiscoverAsync();

        stations.Count.ShouldBe(1);
        var s = stations[0];
        s.LastObservedAtUtc.ShouldNotBeNull();
        s.LastObservedAtUtc!.Value.ShouldBeGreaterThan(DateTime.UtcNow.AddSeconds(-30));
        s.FreshnessMinutes.ShouldBe(0);
        s.OmCloudCover.ShouldBe(40);
        s.OmPrecipProbability.ShouldBe(20);
        s.OmWeatherDescription.ShouldBe("Partly cloudy");
    }

    [Fact]
    public async Task RuntimeLocationLabelIsUsedAsSyntheticStationName()
    {
        var locationLabel = new Faker().Address.City();
        var stations = await DiscoverAsync(locationLabel: locationLabel);

        stations.Count.ShouldBe(1);
        stations[0].Name.ShouldBe(locationLabel);
    }

    [Fact]
    public async Task FinderDiscoveryReturnsNearbyCityCountyAndAirportModelGrids()
    {
        var faker = new Faker();
        var cityName = faker.Address.City();
        var countyName = $"{faker.Address.County()} County";
        var airportName = $"{faker.Address.City()} Municipal Airport";
        var airportCode = faker.Random.String2(3, "ABCDEFGHIJKLMNOPQRSTUVWXYZ");
        var handler = new CapturingHandler(req =>
        {
            if (req.RequestUri!.Host.Contains("overpass", StringComparison.Ordinal))
                return OkJson(BuildOverpassResponseJson(cityName, countyName, airportName, airportCode));

            return OkJson(BuildFullResponseJson());
        });
        var factory = new MultiClientFactory(handler);
        var provider = new OpenMeteoNearbyBaselineProvider(
            factory,
            NullLogger<OpenMeteoNearbyBaselineProvider>.Instance);
        var config = new NeighborConfig
        {
            IsEnabled = true,
            UserLatitude = 41.0000,
            UserLongitude = -99.0000,
            RadiusMiles = 50,
            MaxAgeMinutes = 60,
            MinStations = 1,
            EnabledProviders = [],
            DiscoveryCacheScope = "finder",
            DiscoveryLocationQuery = $"{cityName}, {faker.Address.StateAbbr()}",
        };

        var stations = await provider.DiscoverAsync(config);

        // The far-away city (42.5, -99.0 ≈ 103 miles) is now filtered by strict radius; 3 remain.
        stations.Count.ShouldBe(3);
        stations.Select(station => station.DiscoveryKind).ShouldBe(["city", "county", "airport"]);
        stations.ShouldContain(station => station.Name == cityName);
        stations.ShouldContain(station => station.DiscoveryKind == "city");
        stations.ShouldContain(station => station.Name == countyName);
        stations.ShouldContain(station => station.DiscoveryKind == "county");
        stations.ShouldContain(station => station.Name == $"{airportName} ({airportCode})");
        stations.ShouldContain(station => station.DiscoveryKind == "airport");
        stations.ShouldAllBe(station => station.Provider == "OpenMeteo");
        handler.Requests.Count(request => request.RequestUri!.Host.Contains("api.open-meteo", StringComparison.Ordinal))
            .ShouldBe(3);
        var overpassQuery = Uri.UnescapeDataString(handler.Requests
            .Single(request => request.RequestUri!.Host.Contains("overpass", StringComparison.Ordinal))
            .RequestUri!.Query);
        overpassQuery.ShouldNotContain("is_in(", Case.Sensitive);
        overpassQuery.ShouldNotContain("map_to_area", Case.Sensitive);
        overpassQuery.ShouldNotContain("{0}", Case.Sensitive);
        overpassQuery.ShouldNotContain("{1:F6}", Case.Sensitive);
        overpassQuery.ShouldNotContain("{2:F6}", Case.Sensitive);
    }

    [Fact]
    public async Task FinderDiscoveryReturnsEmptyWhenPlaceLookupTimesOut()
    {
        var handler = new CapturingHandler(req =>
        {
            if (req.RequestUri!.Host.Contains("overpass", StringComparison.Ordinal))
                throw new TaskCanceledException("Generated timeout.");

            return OkJson(BuildFullResponseJson());
        });
        var factory = new MultiClientFactory(handler);
        var provider = new OpenMeteoNearbyBaselineProvider(
            factory,
            NullLogger<OpenMeteoNearbyBaselineProvider>.Instance);
        var config = new NeighborConfig
        {
            IsEnabled = true,
            UserLatitude = 41.0000,
            UserLongitude = -99.0000,
            RadiusMiles = 50,
            MaxAgeMinutes = 60,
            MinStations = 1,
            EnabledProviders = [],
            DiscoveryCacheScope = "finder",
        };

        var stations = await provider.DiscoverAsync(config);

        stations.ShouldBeEmpty();
    }

    [Fact]
    public async Task DailyExtendedFieldsAreMapped()
    {
        var stations = await DiscoverAsync();

        stations.Count.ShouldBe(1);
        var s = stations[0];
        s.OmUvIndexMax.ShouldBe(7);
        s.OmPrecipSumIn.ShouldNotBeNull();
        s.OmPrecipSumIn!.Value.ShouldBe(0.12, tolerance: 0.001);
        s.OmWindSpeedMax.ShouldNotBeNull();
        s.OmWindSpeedMax!.Value.ShouldBe(15.0, tolerance: 0.1);
        s.OmWindGustMax.ShouldNotBeNull();
        s.OmWindGustMax!.Value.ShouldBe(22.0, tolerance: 0.1);
        s.OmWindDirDominant.ShouldBe(270);
    }

    [Fact]
    public async Task SunriseSunsetAreFormattedAsLocalTime()
    {
        var stations = await DiscoverAsync();

        stations.Count.ShouldBe(1);
        var s = stations[0];
        s.OmSunrise.ShouldNotBeNullOrWhiteSpace();
        s.OmSunset.ShouldNotBeNullOrWhiteSpace();
        // Expect short 12-hour time format
        s.OmSunrise!.ShouldContain("AM", Case.Sensitive);
        s.OmSunset!.ShouldContain("PM", Case.Sensitive);
    }

    [Fact]
    public async Task MissingCurrentExtendedFieldsProduceNull()
    {
        var stations = await DiscoverAsync(includeExtendedFields: false);

        stations.Count.ShouldBe(1);
        var s = stations[0];
        s.OmCloudCover.ShouldBeNull();
        s.OmPrecipProbability.ShouldBeNull();
        s.OmWeatherDescription.ShouldBeNull();
    }

    [Fact]
    public async Task RequestUrlIncludesExtendedCurrentAndDailyParams()
    {
        string? capturedUrl = null;
        var handler = new CapturingHandler(req =>
        {
            capturedUrl = req.RequestUri!.Query;
            return OkJson(BuildFullResponseJson());
        });

        await DiscoverWithHandlerAsync(handler);

        capturedUrl.ShouldNotBeNull();
        capturedUrl!.ShouldContain("weather_code", Case.Sensitive);
        capturedUrl!.ShouldContain("cloud_cover", Case.Sensitive);
        capturedUrl!.ShouldContain("precipitation_probability", Case.Sensitive);
        capturedUrl!.ShouldContain("uv_index_max", Case.Sensitive);
        capturedUrl!.ShouldContain("precipitation_sum", Case.Sensitive);
        capturedUrl!.ShouldContain("wind_speed_10m_max", Case.Sensitive);
        capturedUrl!.ShouldContain("wind_gusts_10m_max", Case.Sensitive);
        capturedUrl!.ShouldContain("wind_direction_10m_dominant", Case.Sensitive);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static async Task<IReadOnlyList<NeighborStation>> DiscoverAsync(
        bool includeExtendedFields = true,
        string? locationLabel = null)
    {
        var json = includeExtendedFields ? BuildFullResponseJson() : BuildMinimalResponseJson();
        var handler = new CapturingHandler(_ => OkJson(json));
        return await DiscoverWithHandlerAsync(handler, locationLabel).ConfigureAwait(false);
    }

    private static async Task<IReadOnlyList<NeighborStation>> DiscoverWithHandlerAsync(
        HttpMessageHandler handler,
        string? locationLabel = null)
    {
        var factory = new TestHttpClientFactory(
            OpenMeteoNearbyBaselineProvider.HttpClientName,
            handler,
            new Uri("https://api.open-meteo.com"));

        var provider = new OpenMeteoNearbyBaselineProvider(
            factory,
            NullLogger<OpenMeteoNearbyBaselineProvider>.Instance);

        var config = new NeighborConfig
        {
            IsEnabled = true,
            UserLatitude = 41.8781,
            UserLongitude = -87.6298,
            RadiusMiles = 25,
            MaxAgeMinutes = 60,
            MinStations = 1,
            EnabledProviders = [],
            UserLocationLabel = locationLabel,
        };

        return await provider.DiscoverAsync(config).ConfigureAwait(false);
    }

    private static string BuildFullResponseJson() =>
        """
        {
          "latitude": 41.8781,
          "longitude": -87.6298,
          "current": {
            "time": "2026-06-09T15:00",
            "temperature_2m": 75.2,
            "relative_humidity_2m": 55,
            "apparent_temperature": 76.0,
            "dew_point_2m": 57.0,
            "wind_speed_10m": 10.0,
            "wind_direction_10m": 270,
            "wind_gusts_10m": 18.0,
            "surface_pressure": 1015.0,
            "precipitation": 0.0,
            "uv_index": 5.0,
            "weather_code": 2,
            "cloud_cover": 40
          },
          "hourly": {
            "precipitation_probability": [20]
          },
          "daily": {
            "temperature_2m_max": [91.0],
            "temperature_2m_min": [62.0],
            "uv_index_max": [7.4],
            "precipitation_sum": [0.12],
            "sunrise": ["2026-06-09T05:23"],
            "sunset":  ["2026-06-09T20:15"],
            "wind_speed_10m_max": [15.0],
            "wind_gusts_10m_max": [22.0],
            "wind_direction_10m_dominant": [270.0]
          }
        }
        """;

    private static string BuildMinimalResponseJson() =>
        """
        {
          "latitude": 41.8781,
          "longitude": -87.6298,
          "current": {
            "time": "2026-06-09T15:00",
            "temperature_2m": 75.2,
            "relative_humidity_2m": 55,
            "apparent_temperature": 76.0,
            "dew_point_2m": 57.0,
            "wind_speed_10m": 10.0,
            "wind_direction_10m": 270,
            "wind_gusts_10m": 18.0,
            "surface_pressure": 1015.0,
            "precipitation": 0.0,
            "uv_index": 5.0
          },
          "daily": {
            "temperature_2m_max": [91.0],
            "temperature_2m_min": [62.0]
          }
        }
        """;

    private static string BuildOverpassResponseJson(
        string cityName,
        string countyName,
        string airportName,
        string airportCode) =>
        $$"""
        {
          "elements": [
            {
              "type": "node",
              "id": 1,
              "lat": 41.0500,
              "lon": -99.0500,
              "tags": { "name": "{{cityName}}", "place": "city" }
            },
            {
              "type": "relation",
              "id": 2,
              "center": { "lat": 41.1200, "lon": -99.1200 },
              "tags": { "name": "{{countyName}}", "boundary": "administrative", "admin_level": "6" }
            },
            {
              "type": "node",
              "id": 4,
              "lat": 41.0300,
              "lon": -99.0300,
              "tags": { "name": "{{airportName}}", "aeroway": "aerodrome", "iata": "{{airportCode}}" }
            },
            {
              "type": "node",
              "id": 3,
              "lat": 42.5000,
              "lon": -99.0000,
              "tags": { "name": "Generated Far Away", "place": "city" }
            }
          ]
        }
        """;

    private static HttpResponseMessage OkJson(string body) =>
        new(HttpStatusCode.OK)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json"),
        };

    private sealed class CapturingHandler(Func<HttpRequestMessage, HttpResponseMessage> respond)
        : HttpMessageHandler
    {
        public List<HttpRequestMessage> Requests { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests.Add(request);
            return Task.FromResult(respond(request));
        }
    }

    private sealed class TestHttpClientFactory(
        string expectedName,
        HttpMessageHandler handler,
        Uri baseAddress) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name)
        {
            name.ShouldBe(expectedName);
            return new HttpClient(handler, disposeHandler: false) { BaseAddress = baseAddress };
        }
    }

    private sealed class MultiClientFactory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name)
        {
            var baseAddress = name switch
            {
                OpenMeteoNearbyBaselineProvider.HttpClientName => new Uri("https://api.open-meteo.com"),
                OpenMeteoNearbyBaselineProvider.OverpassClientName => new Uri("https://overpass.test"),
                _ => throw new InvalidOperationException($"Unexpected client {name}."),
            };

            return new HttpClient(handler, disposeHandler: false) { BaseAddress = baseAddress };
        }
    }
}
