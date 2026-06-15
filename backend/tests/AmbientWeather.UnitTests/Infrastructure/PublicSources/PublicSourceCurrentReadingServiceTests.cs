using System.Net;
using System.Text;
using AmbientWeather.Application.DTOs.Realtime;
using AmbientWeather.Domain.Entities;
using AmbientWeather.Infrastructure.PublicSources;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Shouldly;

namespace AmbientWeather.UnitTests.Infrastructure.PublicSources;

public sealed class PublicSourceCurrentReadingServiceTests
{
    [Fact]
    public async Task GetCurrentAsyncShouldMapOpenMeteoUvIndexAndSendTimezone()
    {
        var handler = new CapturingHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                """
                {
                  "timezone": "Etc/GMT+6",
                  "utc_offset_seconds": -21600,
                  "current": {
                    "time": "2026-06-09T15:00",
                    "temperature_2m": 72.4,
                    "relative_humidity_2m": 45,
                    "apparent_temperature": 73.1,
                    "dew_point_2m": 50.2,
                    "pressure_msl": 1012.4,
                    "wind_speed_10m": 8.5,
                    "wind_direction_10m": 190,
                    "wind_gusts_10m": 14.2,
                    "uv_index": 6.6
                  }
                }
                """,
                Encoding.UTF8,
                "application/json"),
        });
        var service = new PublicSourceCurrentReadingService(
            new TestHttpClientFactory(handler),
            CreateCache(),
            NullLogger<PublicSourceCurrentReadingService>.Instance);

        var result = await service.GetCurrentAsync("user", new PublicWeatherSource
        {
            Id = Guid.Parse("11111111-1111-1111-1111-111111111111"),
            Provider = "OpenMeteo",
            SourceId = "open-meteo:35.2000,-97.4000",
            DisplayLabel = "Generated source",
            Latitude = 35.2,
            Longitude = -97.4,
            Timezone = "Etc/GMT+6",
            IsEnabled = true,
            User = new AppUser { AuthProviderSubject = "auth0|test" },
        });

        result.Uv.ShouldBe(7);
        result.Tz.ShouldBe("Etc/GMT+6");
        result.TimestampUtc.ShouldBe(new DateTime(2026, 6, 9, 21, 0, 0, DateTimeKind.Utc));
        handler.Requests
            .Select(request => request.RequestUri?.Query ?? string.Empty)
            .ShouldContain(query => query.Contains("uv_index", StringComparison.Ordinal));
        handler.Requests
            .Select(request => request.RequestUri?.Query ?? string.Empty)
            .ShouldContain(query => query.Contains("timezone=Etc%2FGMT%2B6", StringComparison.Ordinal));
        handler.Requests
            .Select(request => request.RequestUri?.Query ?? string.Empty)
            .ShouldContain(query => query.Contains("models=best_match", StringComparison.Ordinal));
    }

    [Fact]
    public async Task GetCurrentAsyncShouldMapOpenMeteoExtendedCurrentFields()
    {
        var result = await FetchOpenMeteoAsync(ExtendedCurrentResponseJson);

        result.OmCloudCover.ShouldBe(35);
        result.OmPrecipProbability.ShouldBe(15);
        result.OmWeatherDescription.ShouldBe("Partly cloudy");
        result.OmUvIndexMax.ShouldBe(8);
        result.OmPrecipSumIn.ShouldNotBeNull();
        result.OmPrecipSumIn!.Value.ShouldBe(0.05, tolerance: 0.001);
        result.OmWindSpeedMax.ShouldNotBeNull();
        result.OmWindSpeedMax!.Value.ShouldBe(14.0, tolerance: 0.1);
        result.OmWindGustMax.ShouldNotBeNull();
        result.OmWindGustMax!.Value.ShouldBe(20.0, tolerance: 0.1);
        result.OmWindDirDominant.ShouldBe(185);
        result.OmSunrise.ShouldNotBeNullOrWhiteSpace();
        result.OmSunset.ShouldNotBeNullOrWhiteSpace();
        result.OmSunrise!.ShouldContain("AM", Case.Sensitive);
        result.OmSunset!.ShouldContain("PM", Case.Sensitive);
    }

    private const string ExtendedCurrentResponseJson =
        """
        {
          "timezone": "America/Chicago",
          "utc_offset_seconds": -18000,
          "current": {
            "time": "2026-06-09T10:00",
            "temperature_2m": 72.0,
            "relative_humidity_2m": 50,
            "apparent_temperature": 72.0,
            "dew_point_2m": 52.0,
            "pressure_msl": 1013.0,
            "wind_speed_10m": 8.0,
            "wind_direction_10m": 180,
            "wind_gusts_10m": 12.0,
            "uv_index": 4.0,
            "weather_code": 2,
            "cloud_cover": 35
          },
          "hourly": {
            "precipitation_probability": [15]
          },
          "daily": {
            "uv_index_max": [8.2],
            "precipitation_sum": [0.05],
            "sunrise": ["2026-06-09T05:40"],
            "sunset": ["2026-06-09T20:30"],
            "wind_speed_10m_max": [14.0],
            "wind_gusts_10m_max": [20.0],
            "wind_direction_10m_dominant": [185.0]
          }
        }
        """;

    private static async Task<CurrentReadingDto> FetchOpenMeteoAsync(string responseJson)
    {
        var handler = new CapturingHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(responseJson, Encoding.UTF8, "application/json"),
        });
        var service = new PublicSourceCurrentReadingService(
            new TestHttpClientFactory(handler),
            CreateCache(),
            NullLogger<PublicSourceCurrentReadingService>.Instance);
        return await service.GetCurrentAsync("user", new PublicWeatherSource
        {
            Id = Guid.Parse("22222222-2222-2222-2222-222222222222"),
            Provider = "OpenMeteo",
            SourceId = "open-meteo:41.8781,-87.6298",
            DisplayLabel = "Generated source",
            Latitude = 41.8781,
            Longitude = -87.6298,
            Timezone = "America/Chicago",
            IsEnabled = true,
            User = new AppUser { AuthProviderSubject = "auth0|test" },
        }).ConfigureAwait(false);
    }

    [Fact]
    public async Task GetCurrentAsyncRequestUrlIncludesExtendedParams()
    {
        var handler = new CapturingHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                """{"timezone":"UTC","utc_offset_seconds":0,"current":{"time":"2026-06-09T12:00","temperature_2m":70.0,"relative_humidity_2m":50,"apparent_temperature":70.0,"dew_point_2m":50.0,"pressure_msl":1013.0,"wind_speed_10m":5.0,"wind_direction_10m":90,"wind_gusts_10m":8.0,"uv_index":3.0},"daily":{}}""",
                Encoding.UTF8,
                "application/json"),
        });
        var service = new PublicSourceCurrentReadingService(
            new TestHttpClientFactory(handler),
            CreateCache(),
            NullLogger<PublicSourceCurrentReadingService>.Instance);

        await service.GetCurrentAsync("user", new PublicWeatherSource
        {
            Id = Guid.Parse("33333333-3333-3333-3333-333333333333"),
            Provider = "OpenMeteo",
            SourceId = "open-meteo:41.0,-87.0",
            DisplayLabel = "Generated source",
            Latitude = 41.0,
            Longitude = -87.0,
            Timezone = "UTC",
            IsEnabled = true,
            User = new AppUser { AuthProviderSubject = "auth0|test" },
        });

        var query = handler.Requests[0].RequestUri?.Query ?? string.Empty;
        query.ShouldContain("weather_code", Case.Sensitive);
        query.ShouldContain("cloud_cover", Case.Sensitive);
        query.ShouldContain("precipitation_probability", Case.Sensitive);
        query.ShouldContain("uv_index_max", Case.Sensitive);
        query.ShouldContain("precipitation_sum", Case.Sensitive);
        query.ShouldContain("sunrise", Case.Sensitive);
        query.ShouldContain("sunset", Case.Sensitive);
    }

    private static MemoryDistributedCache CreateCache() =>
        new MemoryDistributedCache(Options.Create(new MemoryDistributedCacheOptions()));

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
        public HttpClient CreateClient(string name) =>
            new(handler, disposeHandler: false)
            {
                BaseAddress = new Uri("https://api.open-meteo.com"),
            };
    }
}
