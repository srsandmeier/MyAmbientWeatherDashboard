using System.Net;
using System.Text;
using AmbientWeather.Infrastructure.Neighbors;
using AmbientWeather.Infrastructure.Services;
using AmbientWeather.UnitTests.TestData;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;

namespace AmbientWeather.UnitTests.Infrastructure.Services;

public sealed class NominatimLocationGeocodingServiceTests
{
    [Fact]
    public async Task GeocodeAsyncShouldResolveThreeLetterAirportCodeThroughWeatherGov()
    {
        var latitude = WeatherTestData.Latitude();
        var longitude = WeatherTestData.Longitude();
        var airport = WeatherTestData.Airport();
        var handler = new CapturingHandler(request =>
        {
            if (request.RequestUri!.Host.Contains("weather", StringComparison.Ordinal))
                return OkJson(BuildWeatherGovStationJson(airport, latitude, longitude));

            return OkJson("[]");
        });
        var service = new NominatimLocationGeocodingService(
            new TestHttpClientFactory(handler),
            NullLogger<NominatimLocationGeocodingService>.Instance);

        var result = await service.GeocodeAsync(airport.Iata);

        result.ShouldNotBeNull();
        result.Latitude.ShouldBe(latitude, tolerance: 0.0001);
        result.Longitude.ShouldBe(longitude, tolerance: 0.0001);
        result.DisplayName.ShouldBe(airport.Name);
        handler.Requests.ShouldContain(request => request.RequestUri!.AbsolutePath == $"/stations/{airport.Icao}");
    }

    [Fact]
    public async Task GeocodeAsyncShouldFallbackToNominatimWhenAirportCodeIsNotFound()
    {
        var handler = new CapturingHandler(request =>
        {
            if (request.RequestUri!.Host.Contains("weather", StringComparison.Ordinal))
                return new HttpResponseMessage(HttpStatusCode.NotFound);

            return OkJson($$"""
                [
                  {
                    "lat": "{{WeatherTestData.Coordinate(WeatherTestData.Latitude())}}",
                    "lon": "{{WeatherTestData.Coordinate(WeatherTestData.Longitude())}}",
                    "display_name": "Generated County, Generated State, United States"
                  }
                ]
                """);
        });
        var service = new NominatimLocationGeocodingService(
            new TestHttpClientFactory(handler),
            NullLogger<NominatimLocationGeocodingService>.Instance);

        var result = await service.GeocodeAsync("Generated County, GS");

        result.ShouldNotBeNull();
        result.DisplayName.ShouldBe("Generated County, Generated State, United States");
        handler.Requests.ShouldContain(request => request.RequestUri!.Host.Contains("nominatim", StringComparison.Ordinal));
    }

    [Fact]
    public async Task GeocodeAsyncShouldPreferCityWhenCityAndCountyNamesBothMatch()
    {
        var cityLatitude = WeatherTestData.Latitude();
        var cityLongitude = WeatherTestData.Longitude();
        var airport = WeatherTestData.Airport();
        var cityDisplayName = $"{airport.CityState}, United States";
        var handler = new CapturingHandler(request =>
        {
            if (request.RequestUri!.Host.Contains("weather", StringComparison.Ordinal))
                return new HttpResponseMessage(HttpStatusCode.NotFound);

            return OkJson($$"""
                [
                  {
                    "lat": "{{WeatherTestData.Coordinate(cityLatitude + 1)}}",
                    "lon": "{{WeatherTestData.Coordinate(cityLongitude - 1)}}",
                    "display_name": "Generated County, Generated State, United States",
                    "class": "boundary",
                    "type": "administrative"
                  },
                  {
                    "lat": "{{WeatherTestData.Coordinate(cityLatitude)}}",
                    "lon": "{{WeatherTestData.Coordinate(cityLongitude)}}",
                    "display_name": "{{cityDisplayName}}",
                    "class": "place",
                    "type": "city"
                  }
                ]
                """);
        });
        var service = new NominatimLocationGeocodingService(
            new TestHttpClientFactory(handler),
            NullLogger<NominatimLocationGeocodingService>.Instance);

        var result = await service.GeocodeAsync(airport.CityState);

        result.ShouldNotBeNull();
        result.DisplayName.ShouldBe(cityDisplayName);
        result.Latitude.ShouldBe(cityLatitude, tolerance: 0.0001);
        result.Longitude.ShouldBe(cityLongitude, tolerance: 0.0001);
    }

    [Fact]
    public async Task GeocodeAsyncShouldPreferCountyWhenQueryExplicitlyNamesCounty()
    {
        var countyLatitude = WeatherTestData.Latitude();
        var countyLongitude = WeatherTestData.Longitude();
        var handler = new CapturingHandler(request =>
        {
            if (request.RequestUri!.Host.Contains("weather", StringComparison.Ordinal))
                return new HttpResponseMessage(HttpStatusCode.NotFound);

            return OkJson($$"""
                [
                  {
                    "lat": "{{WeatherTestData.Coordinate(countyLatitude - 1)}}",
                    "lon": "{{WeatherTestData.Coordinate(countyLongitude + 1)}}",
                    "display_name": "{{WeatherTestData.Airport().CityState}}, United States",
                    "class": "place",
                    "type": "city"
                  },
                  {
                    "lat": "{{WeatherTestData.Coordinate(countyLatitude)}}",
                    "lon": "{{WeatherTestData.Coordinate(countyLongitude)}}",
                    "display_name": "Generated County, Generated State, United States",
                    "class": "boundary",
                    "type": "administrative"
                  }
                ]
                """);
        });
        var service = new NominatimLocationGeocodingService(
            new TestHttpClientFactory(handler),
            NullLogger<NominatimLocationGeocodingService>.Instance);

        var result = await service.GeocodeAsync("Generated County, GS");

        result.ShouldNotBeNull();
        result.DisplayName.ShouldBe("Generated County, Generated State, United States");
        result.Latitude.ShouldBe(countyLatitude, tolerance: 0.0001);
        result.Longitude.ShouldBe(countyLongitude, tolerance: 0.0001);
    }

    private static string BuildWeatherGovStationJson(TestAirport airport, double latitude, double longitude) =>
        $$"""
        {
          "geometry": {
            "coordinates": [{{WeatherTestData.Coordinate(longitude)}}, {{WeatherTestData.Coordinate(latitude)}}]
          },
          "properties": {
            "stationIdentifier": "{{airport.Icao}}",
            "name": "{{airport.Name}}"
          }
        }
        """;

    private static HttpResponseMessage OkJson(string body) => new(HttpStatusCode.OK)
    {
        Content = new StringContent(body, Encoding.UTF8, "application/json"),
    };

    private sealed class CapturingHandler(Func<HttpRequestMessage, HttpResponseMessage> respond)
        : HttpMessageHandler
    {
        public List<HttpRequestMessage> Requests { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            Requests.Add(request);
            return Task.FromResult(respond(request));
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
                _ => throw new InvalidOperationException($"Unexpected client {name}."),
            };

            return new HttpClient(handler, disposeHandler: false)
            {
                BaseAddress = baseAddress,
            };
        }
    }
}
