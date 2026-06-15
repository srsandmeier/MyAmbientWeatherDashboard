using AmbientWeather.UnitTests.TestData;
using System.Net;
using Shouldly;

namespace AmbientWeather.IntegrationTests;

/// <summary>
/// Verifies the per-user fixed-window rate limiter rejects requests that exceed the 60/min limit.
/// Phase 7 can replace this with a Redis-backed <c>IRateLimiterPolicy</c> for shared counters
/// across horizontally-scaled instances.
/// </summary>
public class RateLimitTests(TestApplicationFactory factory) : IClassFixture<TestApplicationFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task SixtyFirstRequestShouldReturn429()
    {
        // ApplicationKeyAuthMiddleware requires the app key; [Authorize] challenges without JWT.
        // The rate limiter runs before UseAuthorization, so requests are counted regardless of
        // authentication outcome. We send 61 requests and verify the last one is throttled.

        // Pre-warm: send 60 requests to exhaust the bucket for the "anonymous" partition.
        for (var i = 0; i < 60; i++)
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/devices/{WeatherTestData.ColonMac}/history");
            req.Headers.Add("x-application-key", "test-application-key");
            using var resp = await _client.SendAsync(req);
            // Each request should be throttled eventually but NOT on the first 60.
            resp.StatusCode.ShouldNotBe(HttpStatusCode.TooManyRequests,
                $"Request {i + 1} was unexpectedly rate-limited.");
        }

        // The 61st request should be rejected.
        using var finalReq = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/devices/{WeatherTestData.ColonMac}/history");
        finalReq.Headers.Add("x-application-key", "test-application-key");
        using var finalResp = await _client.SendAsync(finalReq);

        finalResp.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
    }
}
