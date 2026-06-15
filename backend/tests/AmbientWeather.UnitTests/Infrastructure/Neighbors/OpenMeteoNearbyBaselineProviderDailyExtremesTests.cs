using System.Net;
using System.Text;
using AmbientWeather.Domain.Neighbors;
using AmbientWeather.Infrastructure.Neighbors;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;
using Xunit;

namespace AmbientWeather.UnitTests.Infrastructure.Neighbors;

/// <summary>
/// Verifies that <see cref="OpenMeteoNearbyBaselineProvider"/> maps
/// <c>daily.temperature_2m_max[0]</c> and <c>daily.temperature_2m_min[0]</c>
/// to <see cref="NeighborStation.DailyHighTempF"/> / <see cref="NeighborStation.DailyLowTempF"/>.
/// Open-Meteo returns these values already in °F when <c>temperature_unit=fahrenheit</c>.
/// </summary>
public sealed class OpenMeteoNearbyBaselineProviderDailyExtremesTests
{
    [Fact]
    public async Task DailyExtremesAreMappedFromDailyArray()
    {
        var stations = await DiscoverAsync(highF: 91.5, lowF: 62.3);

        stations.Count.ShouldBe(1);
        stations[0].DailyHighTempF.ShouldNotBeNull();
        stations[0].DailyHighTempF!.Value.ShouldBe(91.5, tolerance: 0.01);
        stations[0].DailyLowTempF.ShouldNotBeNull();
        stations[0].DailyLowTempF!.Value.ShouldBe(62.3, tolerance: 0.01);
    }

    [Fact]
    public async Task MissingDailyObjectProducesNull()
    {
        var stations = await DiscoverAsync(includeDailyBlock: false);

        stations.Count.ShouldBe(1);
        stations[0].DailyHighTempF.ShouldBeNull();
        stations[0].DailyLowTempF.ShouldBeNull();
    }

    [Fact]
    public async Task RequestUrlIncludesDailyParameters()
    {
        string? capturedUrl = null;
        var handler = new CapturingHandler(req =>
        {
            capturedUrl = req.RequestUri!.Query;
            return OkJson(BuildResponseJson(highF: 80.0, lowF: 55.0));
        });

        await DiscoverWithHandlerAsync(handler);

        capturedUrl.ShouldNotBeNull();
        capturedUrl!.ShouldContain("temperature_2m_max", Case.Sensitive);
        capturedUrl!.ShouldContain("temperature_2m_min", Case.Sensitive);
        capturedUrl!.ShouldContain("uv_index_max", Case.Sensitive);
        capturedUrl!.ShouldContain("precipitation_sum", Case.Sensitive);
        capturedUrl!.ShouldContain("sunrise", Case.Sensitive);
        capturedUrl!.ShouldContain("sunset", Case.Sensitive);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static async Task<IReadOnlyList<NeighborStation>> DiscoverAsync(
        double? highF = null, double? lowF = null, bool includeDailyBlock = true)
    {
        var responseJson = includeDailyBlock
            ? BuildResponseJson(highF, lowF)
            : BuildResponseJsonNoDailyBlock();

        var handler = new CapturingHandler(_ => OkJson(responseJson));
        return await DiscoverWithHandlerAsync(handler).ConfigureAwait(false);
    }

    private static async Task<IReadOnlyList<NeighborStation>> DiscoverWithHandlerAsync(
        HttpMessageHandler handler)
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
        };

        return await provider.DiscoverAsync(config).ConfigureAwait(false);
    }

    private static string BuildResponseJson(double? highF, double? lowF) =>
        $$"""
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
            "temperature_2m_max": [{{(highF.HasValue ? highF.Value.ToString("F1", System.Globalization.CultureInfo.InvariantCulture) : "null")}}],
            "temperature_2m_min": [{{(lowF.HasValue ? lowF.Value.ToString("F1", System.Globalization.CultureInfo.InvariantCulture) : "null")}}]
          }
        }
        """;

    private static string BuildResponseJsonNoDailyBlock() =>
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
          }
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
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(respond(request));
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
}
