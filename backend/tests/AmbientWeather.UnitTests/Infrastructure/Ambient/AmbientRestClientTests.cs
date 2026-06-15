using AmbientWeather.UnitTests.TestData;
using System.Globalization;
using System.Net;
using System.Text;
using AmbientWeather.Infrastructure.Ambient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Shouldly;

namespace AmbientWeather.UnitTests.Infrastructure.Ambient;

public class AmbientRestClientTests
{
    [Fact]
    public async Task GetDevicesAsyncReturnsDevicesWhenResponseIsSuccess()
    {
        var jsonResponse = "[{\"macAddress\": \"" + WeatherTestData.ColonMac + "\", \"apiKey\": \"123\", \"lastData\": {}, \"info\": {}}]";
        var handler = new CapturingHttpMessageHandler(_ => new HttpResponseMessage
        {
            StatusCode = HttpStatusCode.OK,
            Content = new StringContent(jsonResponse, Encoding.UTF8, "application/json"),
        });
        var client = new AmbientRestClient(CreateApiClient(handler));

        var result = await client.GetDevicesAsync("key", "appKey");

        result.Count.ShouldBe(1);
        result[0].MacAddress.ShouldBe(WeatherTestData.ColonMac);
        handler.Requests.Single().RequestUri?.PathAndQuery.ShouldBe("/v1/devices?applicationKey=appKey&apiKey=key");
    }

    [Fact]
    public async Task GetDeviceHistoryAsyncBuildsCorrectUrlWithLimitAndNoEndDate()
    {
        var handler = new CapturingHttpMessageHandler(_ => JsonResponse("[]"));
        var client = new AmbientRestClient(CreateApiClient(handler));

        await client.GetDeviceHistoryAsync(WeatherTestData.ColonMac, "myKey", "myApp", limit: 100);

        var uri = handler.Requests.Single().RequestUri?.PathAndQuery;
        uri.ShouldNotBeNull();
        uri.ShouldContain($"devices/{Uri.EscapeDataString(WeatherTestData.ColonMac)}");
        uri.ShouldContain("limit=100");
        uri.ShouldContain("apiKey=myKey");
        uri.ShouldContain("applicationKey=myApp");
        uri.ShouldNotContain("endDate");
    }

    [Fact]
    public async Task GetDeviceHistoryAsyncEncodesEndDateAsEpochMilliseconds()
    {
        var endDate = new DateTime(2024, 6, 15, 23, 59, 59, DateTimeKind.Utc);
        var expectedMs = (long)(endDate - DateTime.UnixEpoch).TotalMilliseconds;

        var handler = new CapturingHttpMessageHandler(_ => JsonResponse("[]"));
        var client = new AmbientRestClient(CreateApiClient(handler));

        await client.GetDeviceHistoryAsync(WeatherTestData.ColonMac, "key", "app", endDate: endDate);

        var uri = handler.Requests.Single().RequestUri?.PathAndQuery ?? string.Empty;
        uri.ShouldContain($"endDate={expectedMs.ToString(CultureInfo.InvariantCulture)}");
    }

    [Fact]
    public async Task GetDeviceHistoryAsyncConvertsLocalEndDateToUtcEpoch()
    {
        // Ensure a local DateTime is converted to UTC before computing epoch ms.
        var localDate = new DateTime(2024, 6, 15, 18, 0, 0, DateTimeKind.Local);
        var expectedMs = (long)(localDate.ToUniversalTime() - DateTime.UnixEpoch).TotalMilliseconds;

        var handler = new CapturingHttpMessageHandler(_ => JsonResponse("[]"));
        var client = new AmbientRestClient(CreateApiClient(handler));

        await client.GetDeviceHistoryAsync(WeatherTestData.ColonMac, "key", "app", endDate: localDate);

        var uri = handler.Requests.Single().RequestUri?.PathAndQuery ?? string.Empty;
        uri.ShouldContain($"endDate={expectedMs.ToString(CultureInfo.InvariantCulture)}");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(289)]
    public async Task GetDeviceHistoryAsyncThrowsWhenLimitIsOutOfRange(int limit)
    {
        var client = new AmbientRestClient(CreateApiClient(new CapturingHttpMessageHandler(_ => JsonResponse("[]"))));

        await Should.ThrowAsync<ArgumentException>(
            () => client.GetDeviceHistoryAsync(WeatherTestData.ColonMac, "key", "app", limit: limit));
    }

    [Fact]
    public async Task GetDeviceHistoryAsyncThrowsWhenMacAddressIsEmpty()
    {
        var client = new AmbientRestClient(CreateApiClient(new CapturingHttpMessageHandler(_ => JsonResponse("[]"))));

        await Should.ThrowAsync<ArgumentException>(
            () => client.GetDeviceHistoryAsync(string.Empty, "key", "app"));
    }

    [Fact]
    public async Task GetDeviceHistoryAsyncEncodesSpecialCharsInMacAddress()
    {
        // Ambient history expects colon-separated MACs, which must be percent-encoded in the path segment.
        var handler = new CapturingHttpMessageHandler(_ => JsonResponse("[]"));
        var client = new AmbientRestClient(CreateApiClient(handler));

        await client.GetDeviceHistoryAsync(WeatherTestData.ColonMac, "key", "app");

        var path = handler.Requests.Single().RequestUri?.AbsolutePath ?? string.Empty;
        path.ShouldContain(Uri.EscapeDataString(WeatherTestData.ColonMac));
    }

    private static RateLimitedApiClient CreateApiClient(HttpMessageHandler handler)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["AmbientApi:RateLimits:UserApiKeyIntervalMilliseconds"] = "0",
                ["AmbientApi:RateLimits:ApplicationKeyIntervalMilliseconds"] = "0",
                ["AmbientApi:Resilience:MaxRetryAttempts"] = "0",
                ["AmbientApi:Resilience:BaseRetryDelayMilliseconds"] = "1",
                ["AmbientApi:Resilience:CircuitBreakerFailureThreshold"] = "5",
                ["AmbientApi:Resilience:CircuitBreakerBreakDurationSeconds"] = "1",
            })
            .Build();

        var ambientOptions = new AmbientApiOptions();
        configuration.GetSection(AmbientApiOptions.SectionName).Bind(ambientOptions);

        return new RateLimitedApiClient(
            new TestHttpClientFactory(handler),
            Options.Create(ambientOptions),
            new AmbientRateLimitState(),
            new AmbientCircuitBreakerState(),
            Mock.Of<ILogger<RateLimitedApiClient>>());
    }

    private static HttpResponseMessage JsonResponse(string json) =>
        new(HttpStatusCode.OK)
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json"),
        };
}
