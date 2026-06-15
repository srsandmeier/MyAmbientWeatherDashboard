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
/// NWS text fields (cloudLayers, presentWeather, textDescription, rawMessage)
/// to the corresponding <see cref="NeighborStation"/> properties.
/// </summary>
public sealed class WeatherGovNearbyObservationProviderTextFieldsTests
{
    [Fact]
    public async Task TextFieldsAreMappedFromNwsObservation()
    {
        var stations = await DiscoverAsync(
            cloudLayersJson: """[{"coverage":"overcast","baseHeight":{"value":609}}]""",
            presentWeatherJson: """[{"rawString":"Light Rain"},{"rawString":"Mist"}]""",
            textDescription: "Overcast with light rain and mist.",
            rawMessage: "KORD 091753Z 18015G20KT 10SM -RA BR OVC020 22/14 A2992 RMK AO2");

        stations.Count.ShouldBe(1);
        // cloud layer: OVC @ 609m × 3.28084 ≈ 1998ft → rounded to 2,000
        stations[0].SkyConditions.ShouldBe("OVC @ 2,000ft");
        stations[0].PresentWeather.ShouldBe("Light Rain, Mist");
        stations[0].TextDescription.ShouldBe("Overcast with light rain and mist.");
        stations[0].RawMetar.ShouldBe("KORD 091753Z 18015G20KT 10SM -RA BR OVC020 22/14 A2992 RMK AO2");
    }

    [Fact]
    public async Task NullTextFieldsProduceNullOnStation()
    {
        var stations = await DiscoverAsync(
            cloudLayersJson: "[]",
            presentWeatherJson: "[]",
            textDescription: null,
            rawMessage: null);

        stations.Count.ShouldBe(1);
        stations[0].SkyConditions.ShouldBeNull();
        stations[0].PresentWeather.ShouldBeNull();
        stations[0].TextDescription.ShouldBeNull();
        stations[0].RawMetar.ShouldBeNull();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static async Task<IReadOnlyList<NeighborStation>> DiscoverAsync(
        string cloudLayersJson,
        string presentWeatherJson,
        string? textDescription,
        string? rawMessage)
    {
        var ts = DateTime.UtcNow.AddMinutes(-5).ToString("o", System.Globalization.CultureInfo.InvariantCulture);
        var textDescJson = textDescription is not null ? $"\"{textDescription}\"" : "null";
        var rawMsgJson = rawMessage is not null ? $"\"{rawMessage}\"" : "null";

        var obsJson =
            "{\"properties\":{" +
            $"\"timestamp\":\"{ts}\"," +
            "\"temperature\":{\"value\":22.0}," +
            "\"relativeHumidity\":{\"value\":60.0}," +
            "\"windSpeed\":{\"value\":15.0}," +
            "\"windDirection\":{\"value\":180.0}," +
            "\"windGust\":{\"value\":20.0}," +
            "\"barometricPressure\":{\"value\":101325.0}," +
            "\"dewpoint\":{\"value\":14.0}," +
            $"\"cloudLayers\":{cloudLayersJson}," +
            $"\"presentWeather\":{presentWeatherJson}," +
            $"\"textDescription\":{textDescJson}," +
            $"\"rawMessage\":{rawMsgJson}" +
            "}}";

        var handler = new StubHttpMessageHandler(request =>
        {
            var url = request.RequestUri!.PathAndQuery;
            if (url.StartsWith("/points/", StringComparison.Ordinal))
                return Ok("""{"properties":{"observationStations":"https://api.weather.gov/stations"}}""");
            if (url.Contains("/stations", StringComparison.Ordinal) && !url.Contains("/observations", StringComparison.Ordinal))
                return Ok("""{"features":[{"geometry":{"coordinates":[-90.0,40.0]},"properties":{"stationIdentifier":"KORD","name":"Chicago OHare"}}]}""");
            if (url.Contains("/observations/latest", StringComparison.Ordinal))
                return Ok(obsJson);
            return new HttpResponseMessage(HttpStatusCode.NotFound);
        });

        var factory = new TestHttpClientFactory(
            WeatherGovNearbyObservationProvider.HttpClientName,
            handler,
            new Uri("https://api.weather.gov"));

        var provider = new WeatherGovNearbyObservationProvider(
            factory, NullLogger<WeatherGovNearbyObservationProvider>.Instance);

        return await provider.DiscoverAsync(new NeighborConfig
        {
            IsEnabled = true,
            UserLatitude = 40.0,
            UserLongitude = -90.0,
            RadiusMiles = 25,
            MaxAgeMinutes = 60,
            MinStations = 1,
            EnabledProviders = [],
        }).ConfigureAwait(false);
    }

    private static HttpResponseMessage Ok(string body) =>
        new(HttpStatusCode.OK) { Content = new StringContent(body, Encoding.UTF8, "application/json") };

    private sealed class StubHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> respond)
        : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) =>
            Task.FromResult(respond(request));
    }

    private sealed class TestHttpClientFactory(string expectedName, HttpMessageHandler handler, Uri baseAddress)
        : IHttpClientFactory
    {
        public HttpClient CreateClient(string name)
        {
            name.ShouldBe(expectedName);
            return new HttpClient(handler, disposeHandler: false) { BaseAddress = baseAddress };
        }
    }
}
