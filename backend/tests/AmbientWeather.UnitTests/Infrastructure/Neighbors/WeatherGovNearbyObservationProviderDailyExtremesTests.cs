using System.Net;
using System.Text;
using AmbientWeather.Domain.Neighbors;
using AmbientWeather.Infrastructure.Neighbors;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;
using Xunit;

namespace AmbientWeather.UnitTests.Infrastructure.Neighbors;

/// <summary>
/// Verifies that <see cref="WeatherGovNearbyObservationProvider"/> maps
/// <c>maxTemperatureLast24Hours</c> and <c>minTemperatureLast24Hours</c> (Celsius, from
/// the NWS observations endpoint) to <see cref="NeighborStation.DailyHighTempF"/> /
/// <see cref="NeighborStation.DailyLowTempF"/> (°F).
/// </summary>
public sealed class WeatherGovNearbyObservationProviderDailyExtremesTests
{
    // 20 °C → 68 °F, 5 °C → 41 °F
    private const double HighCelsius = 20.0;
    private const double LowCelsius = 5.0;
    private const double HighFahrenheit = 68.0;
    private const double LowFahrenheit = 41.0;

    [Fact]
    public async Task DailyExtremesAreMappedFromNwsObservation()
    {
        var stations = await DiscoverAsync(highC: HighCelsius, lowC: LowCelsius);

        stations.Count.ShouldBe(1);
        stations[0].DailyHighTempF.ShouldNotBeNull();
        stations[0].DailyHighTempF!.Value.ShouldBe(HighFahrenheit, tolerance: 0.1);
        stations[0].DailyLowTempF.ShouldNotBeNull();
        stations[0].DailyLowTempF!.Value.ShouldBe(LowFahrenheit, tolerance: 0.1);
    }

    [Fact]
    public async Task MissingDailyExtremesProduceNull()
    {
        var stations = await DiscoverAsync(highC: null, lowC: null);

        stations.Count.ShouldBe(1);
        stations[0].DailyHighTempF.ShouldBeNull();
        stations[0].DailyLowTempF.ShouldBeNull();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static async Task<IReadOnlyList<NeighborStation>> DiscoverAsync(
        double? highC, double? lowC)
    {
        var highJson = highC.HasValue
            ? string.Create(System.Globalization.CultureInfo.InvariantCulture, $"{{\"value\":{highC.Value}}}")
            : "null";
        var lowJson = lowC.HasValue
            ? string.Create(System.Globalization.CultureInfo.InvariantCulture, $"{{\"value\":{lowC.Value}}}")
            : "null";

        var recentTimestamp = DateTime.UtcNow.AddMinutes(-5).ToString("o", System.Globalization.CultureInfo.InvariantCulture);
        var obsJson =
            "{\"properties\":{" +
            $"\"timestamp\":\"{recentTimestamp}\"," +
            "\"temperature\":{\"value\":22.0}," +
            "\"relativeHumidity\":{\"value\":60.0}," +
            "\"windSpeed\":{\"value\":15.0}," +
            "\"windDirection\":{\"value\":180.0}," +
            "\"windGust\":{\"value\":20.0}," +
            "\"barometricPressure\":{\"value\":101325.0}," +
            "\"dewpoint\":{\"value\":14.0}," +
            "\"maxTemperatureLast24Hours\":" + highJson + "," +
            "\"minTemperatureLast24Hours\":" + lowJson +
            "}}";

        var handler = new StubHttpMessageHandler(request =>
        {
            var url = request.RequestUri!.PathAndQuery;

            if (url.StartsWith("/points/", StringComparison.Ordinal))
                return Json("""{"properties":{"observationStations":"https://api.weather.gov/stations"}}""");

            if (url.Contains("/stations", StringComparison.Ordinal) && !url.Contains("/observations", StringComparison.Ordinal))
                return Json("""{"features":[{"geometry":{"coordinates":[-90.0,40.0]},"properties":{"stationIdentifier":"KORD","name":"Chicago OHare"}}]}""");

            if (url.Contains("/observations/latest", StringComparison.Ordinal))
                return Json(obsJson);

            return new HttpResponseMessage(HttpStatusCode.NotFound);
        });

        var factory = new TestHttpClientFactory(
            WeatherGovNearbyObservationProvider.HttpClientName,
            handler,
            new Uri("https://api.weather.gov"));

        var provider = new WeatherGovNearbyObservationProvider(
            factory,
            NullLogger<WeatherGovNearbyObservationProvider>.Instance);

        var config = new NeighborConfig
        {
            IsEnabled = true,
            UserLatitude = 40.0,
            UserLongitude = -90.0,
            RadiusMiles = 25,
            MaxAgeMinutes = 60,
            MinStations = 1,
            EnabledProviders = [],
        };

        return await provider.DiscoverAsync(config).ConfigureAwait(false);
    }

    private static HttpResponseMessage Json(string body) =>
        new(HttpStatusCode.OK)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json"),
        };

    private sealed class StubHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> respond)
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
