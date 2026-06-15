using AmbientWeather.UnitTests.TestData;
using System.Net;
using System.Net.Http.Json;
using AmbientWeather.Application.DTOs.Common;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Shouldly;
using Xunit;

namespace AmbientWeather.IntegrationTests;

public class DeviceHistoryControllerAuthTests(TestApplicationFactory factory) : IClassFixture<TestApplicationFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    public static TheoryData<string> AuthorizedMacSamples => new()
    {
        "00:11:22:33:44:55",
        WeatherTestData.Mac,
    };

    [Theory]
    [MemberData(nameof(AuthorizedMacSamples))]
    public async Task GetDeviceHistoryShouldReturn401WhenUnauthorized(string macAddress)
    {
        var response = await _client.GetAsync($"/api/v1/devices/{macAddress}/history");
        // ApplicationKeyAuthMiddleware was removed — [Authorize] rejects unauthenticated requests.
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Theory]
    [MemberData(nameof(AuthorizedMacSamples))]
    public async Task InvalidateDeviceCacheShouldReturn401WhenUnauthorized(string macAddress)
    {
        var response = await _client.DeleteAsync($"/api/v1/devices/{macAddress}/cache");
        // ApplicationKeyAuthMiddleware was removed — [Authorize] rejects unauthenticated requests.
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    // MAC address format validation (400) requires a valid JWT to reach the controller.
    // Without a JWT, authorization rejects the request with 401 before validation runs.
    [Theory]
    [InlineData("not-a-mac")]
    [InlineData("00:11:22")]
    public async Task GetDeviceHistoryShouldReturn401WhenMacAddressIsInvalidAndNoBearerToken(string macAddress)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/devices/{macAddress}/history");

        var response = await _client.SendAsync(request);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetDeviceHistoryShouldReturn401WhenBearerTokenIsInvalid()
    {
        // ApplicationKeyAuthMiddleware removed — JWT auth rejects invalid bearer tokens.
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/devices/{WeatherTestData.ColonMac}/history");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", "any-invalid-token");

        var response = await _client.SendAsync(request);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task StartupShouldSucceedAndRouteToJwtAuthWhenNoAppKeyPresent()
    {
        // ApplicationKeyAuthMiddleware is no longer registered — requests without an
        // x-application-key header fall through directly to JWT auth.
        using var factoryWithoutKey = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder => builder.UseEnvironment("Testing"));

        using var client = factoryWithoutKey.CreateClient();

        var response = await client.GetAsync($"/api/v1/devices/{WeatherTestData.ColonMac}/history");
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        var body = await response.Content.ReadAsStringAsync();
        body.ShouldNotContain("applicationKey-invalid");
    }

    [Fact]
    public async Task GetDeviceHistoryShouldReturn401WhenNoBearerTokenPresent()
    {
        // No JWT → [Authorize] returns 401 regardless of any other headers.
        var response = await _client.GetAsync($"/api/v1/devices/{WeatherTestData.ColonMac}/history");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }
}
