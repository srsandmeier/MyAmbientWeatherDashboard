using System.Net;
using System.Text;
using AmbientWeather.Infrastructure.Alerts;
using Bogus;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Moq.Protected;
using Shouldly;

namespace AmbientWeather.UnitTests.Infrastructure.Alerts;

public sealed class WeatherGovAlertServiceTests
{
    private static readonly Faker F = new();

    [Fact]
    public async Task GetActiveAlertsAsyncShouldReturnEmptyOutsideWeatherGovCoverage()
    {
        var handler = CreateHandler("{}");
        var factory = CreateFactory(handler);
        var service = CreateService(factory.Object);

        var result = await service.GetActiveAlertsAsync(
            F.Random.AlphaNumeric(16),
            F.Random.Double(-80, -20),
            F.Random.Double(20, 160),
            CancellationToken.None);

        result.ShouldBeEmpty();
        handler.Protected().Verify(
            "SendAsync",
            Times.Never(),
            ItExpr.IsAny<HttpRequestMessage>(),
            ItExpr.IsAny<CancellationToken>());
    }

    [Fact]
    public async Task GetActiveAlertsAsyncShouldMapWeatherGovAlerts()
    {
        var alertId = F.Random.AlphaNumeric(12);
        var alertEvent = $"Generated event {F.Random.AlphaNumeric(4)}";
        var headline = $"Generated headline {F.Random.AlphaNumeric(4)}";
        var handler = CreateHandler($$"""
            {
              "features": [
                {
                  "id": "{{alertId}}",
                  "properties": {
                    "event": "{{alertEvent}}",
                    "headline": "{{headline}}",
                    "description": "Generated description",
                    "severity": "Severe",
                    "urgency": "Immediate",
                    "certainty": "Likely",
                    "effective": "2026-06-05T15:00:00-05:00",
                    "expires": "2026-06-05T17:00:00-05:00",
                    "areaDesc": "Generated area"
                  }
                }
              ]
            }
            """);
        var factory = CreateFactory(handler);
        var service = CreateService(factory.Object);

        var result = await service.GetActiveAlertsAsync(
            F.Random.AlphaNumeric(16),
            F.Random.Double(18, 71),
            F.Random.Double(-179, -61),
            CancellationToken.None);

        result.Count.ShouldBe(1);
        result[0].Id.ShouldBe(alertId);
        result[0].Event.ShouldBe(alertEvent);
        result[0].Headline.ShouldBe(headline);
        result[0].EffectiveUtc.ShouldNotBeNull();
        result[0].ExpiresUtc.ShouldNotBeNull();
    }

    [Fact]
    public async Task GetActiveAlertsAsyncShouldUseCacheOnSecondCall()
    {
        var handler = CreateHandler("""{"features":[]}""");
        var factory = CreateFactory(handler);
        var service = CreateService(factory.Object);
        var userHash = F.Random.AlphaNumeric(16);
        var lat = F.Random.Double(18, 71);
        var lon = F.Random.Double(-179, -61);

        await service.GetActiveAlertsAsync(userHash, lat, lon, CancellationToken.None);
        await service.GetActiveAlertsAsync(userHash, lat, lon, CancellationToken.None);

        handler.Protected().Verify(
            "SendAsync",
            Times.Once(),
            ItExpr.IsAny<HttpRequestMessage>(),
            ItExpr.IsAny<CancellationToken>());
    }

    [Fact]
    public async Task GetActiveAlertsForAreaAsyncShouldMapWeatherGovAlerts()
    {
        var alertId = F.Random.AlphaNumeric(12);
        var handler = CreateHandler($$"""
            {
              "features": [
                {
                  "id": "{{alertId}}",
                  "properties": {
                    "event": "Generated area event",
                    "headline": "Generated area headline",
                    "severity": "Moderate"
                  }
                }
              ]
            }
            """);
        var factory = CreateFactory(handler);
        var service = CreateService(factory.Object);
        var areaCode = F.Address.StateAbbr();

        var result = await service.GetActiveAlertsForAreaAsync(
            F.Random.AlphaNumeric(16),
            areaCode.ToLowerInvariant(),
            CancellationToken.None);

        result.Count.ShouldBe(1);
        result[0].Id.ShouldBe(alertId);
        handler.Protected().Verify(
            "SendAsync",
            Times.Once(),
            ItExpr.Is<HttpRequestMessage>(request =>
                request.RequestUri != null && request.RequestUri.Query.Contains($"area={areaCode}", StringComparison.Ordinal)),
            ItExpr.IsAny<CancellationToken>());
    }

    [Fact]
    public async Task GetActiveAlertsForAreaAsyncShouldReturnEmptyForUnsupportedAreaCode()
    {
        var handler = CreateHandler("""{"features":[]}""");
        var factory = CreateFactory(handler);
        var service = CreateService(factory.Object);

        var result = await service.GetActiveAlertsForAreaAsync(
            F.Random.AlphaNumeric(16),
            "../bad",
            CancellationToken.None);

        result.ShouldBeEmpty();
        handler.Protected().Verify(
            "SendAsync",
            Times.Never(),
            ItExpr.IsAny<HttpRequestMessage>(),
            ItExpr.IsAny<CancellationToken>());
    }

    [Fact]
    public async Task GetActiveAlertsAsyncShouldReturnEmptyWhenWeatherGovFails()
    {
        var handler = CreateHandler("{}", HttpStatusCode.InternalServerError);
        var factory = CreateFactory(handler);
        var service = CreateService(factory.Object);

        var result = await service.GetActiveAlertsAsync(
            F.Random.AlphaNumeric(16),
            F.Random.Double(18, 71),
            F.Random.Double(-179, -61),
            CancellationToken.None);

        result.ShouldBeEmpty();
    }

    private static WeatherGovAlertService CreateService(IHttpClientFactory factory) =>
        new(factory, CreateCache(), NullLogger<WeatherGovAlertService>.Instance);

    private static MemoryDistributedCache CreateCache() =>
        new MemoryDistributedCache(Options.Create(new MemoryDistributedCacheOptions()));

    private static Mock<IHttpClientFactory> CreateFactory(Mock<HttpMessageHandler> handler)
    {
        var client = new HttpClient(handler.Object)
        {
            BaseAddress = new Uri("https://api.weather.gov"),
        };
        var factory = new Mock<IHttpClientFactory>();
        factory
            .Setup(f => f.CreateClient(It.IsAny<string>()))
            .Returns(client);
        return factory;
    }

    private static Mock<HttpMessageHandler> CreateHandler(
        string body,
        HttpStatusCode statusCode = HttpStatusCode.OK)
    {
        var handler = new Mock<HttpMessageHandler>(MockBehavior.Strict);
        handler
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage(statusCode)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/geo+json"),
            });
        return handler;
    }
}
