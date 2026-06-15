using System.Net;
using System.Text;
using AmbientWeather.Infrastructure.Neighbors;
using AmbientWeather.Infrastructure.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;

namespace AmbientWeather.UnitTests.Infrastructure.Services;

public sealed class NominatimLocationGeocodingServiceTests
{
    [Fact]
    public async Task GeocodeAsyncShouldResolveThreeLetterAirportCodeThroughWeatherGov()
    {
        var handler = new CapturingHandler(request =>
        {
            if (request.RequestUri!.Host.Contains("weather", StringComparison.Ordinal))
                return OkJson(BuildWeatherGovStationJson());

            return OkJson("[]");
        });
        var service = new NominatimLocationGeocodingService(
            new TestHttpClientFactory(handler),
            NullLogger<NominatimLocationGeocodingService>.Instance);

        var result = await service.GeocodeAsync("GEN");

        result.ShouldNotBeNull();
        result.Latitude.ShouldBe(39.0483);
        result.Longitude.ShouldBe(-95.6780);
        result.DisplayName.ShouldBe("Generated Municipal Airport");
        handler.Requests.ShouldContain(request => request.RequestUri!.AbsolutePath == "/stations/KGEN");
    }

    [Fact]
    public async Task GeocodeAsyncShouldFallbackToNominatimWhenAirportCodeIsNotFound()
    {
        var handler = new CapturingHandler(request =>
        {
            if (request.RequestUri!.Host.Contains("weather", StringComparison.Ordinal))
                return new HttpResponseMessage(HttpStatusCode.NotFound);

            return OkJson("""
                [
                  {
                    "lat": "39.0483",
                    "lon": "-95.6780",
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
        var handler = new CapturingHandler(request =>
        {
            if (request.RequestUri!.Host.Contains("weather", StringComparison.Ordinal))
                return new HttpResponseMessage(HttpStatusCode.NotFound);

            return OkJson("""
                [
                  {
                    "lat": "40.0000",
                    "lon": "-96.0000",
                    "display_name": "Generated County, Generated State, United States",
                    "class": "boundary",
                    "type": "administrative"
                  },
                  {
                    "lat": "39.0000",
                    "lon": "-95.0000",
                    "display_name": "Generated City, Generated State, United States",
                    "class": "place",
                    "type": "city"
                  }
                ]
                """);
        });
        var service = new NominatimLocationGeocodingService(
            new TestHttpClientFactory(handler),
            NullLogger<NominatimLocationGeocodingService>.Instance);

        var result = await service.GeocodeAsync("Generated City, GS");

        result.ShouldNotBeNull();
        result.DisplayName.ShouldBe("Generated City, Generated State, United States");
        result.Latitude.ShouldBe(39.0000);
        result.Longitude.ShouldBe(-95.0000);
    }

    [Fact]
    public async Task GeocodeAsyncShouldPreferCountyWhenQueryExplicitlyNamesCounty()
    {
        var handler = new CapturingHandler(request =>
        {
            if (request.RequestUri!.Host.Contains("weather", StringComparison.Ordinal))
                return new HttpResponseMessage(HttpStatusCode.NotFound);

            return OkJson("""
                [
                  {
                    "lat": "39.0000",
                    "lon": "-95.0000",
                    "display_name": "Generated City, Generated State, United States",
                    "class": "place",
                    "type": "city"
                  },
                  {
                    "lat": "40.0000",
                    "lon": "-96.0000",
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
        result.Latitude.ShouldBe(40.0000);
        result.Longitude.ShouldBe(-96.0000);
    }

    private static string BuildWeatherGovStationJson() =>
        """
        {
          "geometry": {
            "coordinates": [-95.6780, 39.0483]
          },
          "properties": {
            "stationIdentifier": "KGEN",
            "name": "Generated Municipal Airport"
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
