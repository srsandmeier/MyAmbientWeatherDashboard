using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Shouldly;

namespace AmbientWeather.IntegrationTests;

/// <summary>Integration tests for health check endpoints.</summary>
public sealed class HealthEndpointTests : IClassFixture<TestApplicationFactory>
{
    private readonly HttpClient _client;

    public HealthEndpointTests(TestApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetHealthReturnsOk()
    {
        var response = await _client.GetAsync("/api/health");
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetHealthLiveReturnsOk()
    {
        var response = await _client.GetAsync("/api/health/live");
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetHealthLiveReturnsHealthyStatus()
    {
        var response = await _client.GetAsync("/api/health/live");
        var body = await response.Content.ReadAsStringAsync();

        using var doc = JsonDocument.Parse(body);
        doc.RootElement.GetProperty("status").GetString().ShouldBe("Healthy");
    }

    [Fact]
    public async Task GetHealthLiveResponseIncludesTimestamp()
    {
        var response = await _client.GetAsync("/api/health/live");
        var body = await response.Content.ReadAsStringAsync();

        using var doc = JsonDocument.Parse(body);
        doc.RootElement.TryGetProperty("timestamp", out _).ShouldBeTrue();
    }

    [Fact]
    public async Task GetHealthReadyReturnsOk()
    {
        var response = await _client.GetAsync("/api/health/ready");
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetHealthReadyReturnsHealthyStatus()
    {
        var response = await _client.GetAsync("/api/health/ready");
        var body = await response.Content.ReadAsStringAsync();

        using var doc = JsonDocument.Parse(body);
        doc.RootElement.GetProperty("status").GetString().ShouldBe("Healthy");
    }

    [Fact]
    public async Task GetHealthReadyResponseIncludesChecksArray()
    {
        var response = await _client.GetAsync("/api/health/ready");
        var body = await response.Content.ReadAsStringAsync();

        using var doc = JsonDocument.Parse(body);
        doc.RootElement.TryGetProperty("checks", out var checks).ShouldBeTrue();
        checks.GetArrayLength().ShouldBeGreaterThan(0);
    }

    [Fact]
    public async Task GetHealthReadyTestingEnvironmentReportsCacheCheck()
    {
        // In Testing environment, Postgres is not configured so no database check is added.
        // The cache check must be present and report the in-memory fallback clearly.
        var response = await _client.GetAsync("/api/health/ready");
        var body = await response.Content.ReadAsStringAsync();

        using var doc = JsonDocument.Parse(body);
        var checks = doc.RootElement.GetProperty("checks").EnumerateArray().ToList();
        var cacheCheck = checks.FirstOrDefault(c =>
            string.Equals(c.GetProperty("name").GetString(), "cache", StringComparison.Ordinal));

        cacheCheck.ValueKind.ShouldNotBe(JsonValueKind.Undefined);
        cacheCheck.GetProperty("status").GetString().ShouldBe("Healthy");
        (cacheCheck.GetProperty("description").GetString() ?? string.Empty)
            .ShouldContain("memory", Case.Insensitive);
    }

    [Fact]
    public async Task HealthEndpointsAllowAnonymousAccess()
    {
        // Health endpoints must not require authentication — used by container probes.
        var live = await _client.GetAsync("/api/health/live");
        var ready = await _client.GetAsync("/api/health/ready");
        var health = await _client.GetAsync("/api/health");

        live.StatusCode.ShouldNotBe(HttpStatusCode.Unauthorized);
        ready.StatusCode.ShouldNotBe(HttpStatusCode.Unauthorized);
        health.StatusCode.ShouldNotBe(HttpStatusCode.Unauthorized);
    }
}
