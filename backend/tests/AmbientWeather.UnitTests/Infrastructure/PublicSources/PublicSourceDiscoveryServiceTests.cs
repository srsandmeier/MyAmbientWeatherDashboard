using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;
using AmbientWeather.Infrastructure.Neighbors;
using AmbientWeather.Infrastructure.Services;
using Bogus;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;

namespace AmbientWeather.UnitTests.Infrastructure.PublicSources;

public sealed class PublicSourceDiscoveryServiceTests
{
    private static readonly Faker F = new();

    [Fact]
    public async Task DiscoverAsyncShouldReturnOpenMeteoSourceWithResolvedTimezoneWhenWeatherGovHasNoStations()
    {
        var latitude = F.Address.Latitude(min: 25, max: 49);
        var longitude = F.Address.Longitude(min: -124, max: -67);
        var locationName = $"{F.Address.City()}, {F.Address.StateAbbr()}";
        var timezone = "Etc/GMT+6";
        var handler = new CapturingHttpMessageHandler(request =>
        {
            var host = request.RequestUri?.Host ?? string.Empty;
            if (host.Contains("nominatim", StringComparison.Ordinal))
            {
                return JsonResponse(JsonSerializer.Serialize(new[]
                {
                    new Dictionary<string, string?>(StringComparer.Ordinal)
                    {
                        ["lat"] = latitude.ToString(CultureInfo.InvariantCulture),
                        ["lon"] = longitude.ToString(CultureInfo.InvariantCulture),
                        ["display_name"] = locationName,
                    },
                }));
            }

            if (host.Contains("weather", StringComparison.Ordinal))
            {
                return new HttpResponseMessage(HttpStatusCode.NotFound);
            }

            return JsonResponse($$"""
                {
                  "timezone": "{{timezone}}",
                  "current": {
                    "time": "2026-06-09T15:00",
                    "temperature_2m": 72.4
                  }
                }
                """);
        });
        var service = new PublicSourceDiscoveryService(
            new TestHttpClientFactory(handler),
            NullLogger<PublicSourceDiscoveryService>.Instance);

        var results = await service.DiscoverAsync(F.Address.ZipCode());

        var openMeteo = results.Single(result => string.Equals(result.Provider, "OpenMeteo", StringComparison.Ordinal));
        openMeteo.DisplayLabel.ShouldStartWith("Open-Meteo");
        openMeteo.Latitude.ShouldBe(latitude, tolerance: 0.0001);
        openMeteo.Longitude.ShouldBe(longitude, tolerance: 0.0001);
        openMeteo.Timezone.ShouldBe(timezone);
        handler.Requests
            .Select(request => request.RequestUri?.Query ?? string.Empty)
            .ShouldContain(query => query.Contains("timezone=auto", StringComparison.Ordinal));
        handler.Requests
            .Select(request => request.RequestUri?.Query ?? string.Empty)
            .ShouldContain(query => query.Contains("models=best_match", StringComparison.Ordinal));
    }

    [Fact]
    public async Task DiscoverAsyncShouldReturnMultipleOpenMeteoPlaceCandidates()
    {
        var cityLatitude = F.Address.Latitude(min: 25, max: 49);
        var cityLongitude = F.Address.Longitude(min: -124, max: -67);
        var countyLatitude = cityLatitude + 0.1;
        var countyLongitude = cityLongitude - 0.1;
        var cityName = $"Generated City {F.Random.AlphaNumeric(4)}, Generated State, United States";
        var countyName = $"Generated County {F.Random.AlphaNumeric(4)}, Generated State, United States";
        var handler = CreateMultiPlaceDiscoveryHandler(
            cityLatitude,
            cityLongitude,
            cityName,
            countyLatitude,
            countyLongitude,
            countyName);
        var service = new PublicSourceDiscoveryService(
            new TestHttpClientFactory(handler),
            NullLogger<PublicSourceDiscoveryService>.Instance);

        var results = await service.DiscoverAsync($"Generated {F.Address.ZipCode()}");

        var openMeteo = results
            .Where(result => string.Equals(result.Provider, "OpenMeteo", StringComparison.Ordinal))
            .ToList();
        openMeteo.Count.ShouldBe(2);
        openMeteo.ShouldContain(result => result.DisplayLabel == $"Open-Meteo — {cityName}");
        openMeteo.ShouldContain(result => result.DisplayLabel == $"Open-Meteo — {countyName}");
        openMeteo.ShouldNotContain(result => result.DisplayLabel.Contains("building", StringComparison.OrdinalIgnoreCase));
        handler.Requests
            .Select(request => request.RequestUri?.Query ?? string.Empty)
            .ShouldContain(query => query.Contains("addressdetails=1", StringComparison.Ordinal));
    }

    private static CapturingHttpMessageHandler CreateMultiPlaceDiscoveryHandler(
        double cityLatitude,
        double cityLongitude,
        string cityName,
        double countyLatitude,
        double countyLongitude,
        string countyName) => new(request =>
    {
        var host = request.RequestUri?.Host ?? string.Empty;
        if (host.Contains("nominatim", StringComparison.Ordinal))
        {
            return JsonResponse(JsonSerializer.Serialize(new object[]
            {
                NominatimFixture(cityLatitude, cityLongitude, cityName, "place", "city"),
                NominatimFixture(countyLatitude, countyLongitude, countyName, "boundary", "county"),
                NominatimFixture(cityLatitude + 1, cityLongitude + 1, $"Generated building {F.Random.AlphaNumeric(4)}", "building", "yes"),
            }));
        }

        if (host.Contains("weather", StringComparison.Ordinal))
            return new HttpResponseMessage(HttpStatusCode.NotFound);

        return JsonResponse("""
            {
              "timezone": "Etc/GMT+5",
              "current": {
                "time": "2026-06-09T15:00",
                "temperature_2m": 72.4
              }
            }
            """);
    });

    private static object NominatimFixture(
        double latitude,
        double longitude,
        string displayName,
        string category,
        string type) => new
        {
            lat = latitude.ToString(CultureInfo.InvariantCulture),
            lon = longitude.ToString(CultureInfo.InvariantCulture),
            display_name = displayName,
            @class = category,
            type,
        };

    private static HttpResponseMessage JsonResponse(string json) => new(HttpStatusCode.OK)
    {
        Content = new StringContent(json, Encoding.UTF8, "application/json"),
    };

    private sealed class CapturingHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> responseFactory)
        : HttpMessageHandler
    {
        public List<HttpRequestMessage> Requests { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            Requests.Add(request);
            return Task.FromResult(responseFactory(request));
        }
    }

    private sealed class TestHttpClientFactory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name)
        {
            var baseAddress = name switch
            {
                PublicSourceDiscoveryService.NominatimClientName => new Uri("https://nominatim.test"),
                WeatherGovNearbyObservationProvider.HttpClientName => new Uri("https://api.weather.gov"),
                OpenMeteoNearbyBaselineProvider.HttpClientName => new Uri("https://api.open-meteo.com"),
                _ => throw new InvalidOperationException($"Unexpected client {name}."),
            };

            return new HttpClient(handler, disposeHandler: false)
            {
                BaseAddress = baseAddress,
            };
        }
    }
}
