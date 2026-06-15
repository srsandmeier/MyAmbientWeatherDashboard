using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Shouldly;

namespace AmbientWeather.IntegrationTests;

/// <summary>Verifies telemetry startup behavior in both disabled and enabled configurations.</summary>
public sealed class TelemetryStartupTests : IClassFixture<TestApplicationFactory>
{
    private readonly HttpClient _client;

    public TelemetryStartupTests(TestApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task ApplicationStartsSuccessfullyWithoutTelemetryConnectionString()
    {
        // TestApplicationFactory does not configure AzureMonitor:ConnectionString.
        // The app must start and serve requests normally when telemetry is disabled.
        var response = await _client.GetAsync("/api/health");
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ApplicationStartsSuccessfullyWithFakeTelemetryConnectionString()
    {
        // When a connection string is present, the Azure Monitor exporter is registered.
        // The app must not crash at startup even though the key is fake (the exporter
        // fails silently on first flush — it does not throw during registration).
        await using var factory = new TelemetryEnabledApplicationFactory();
        var client = factory.CreateClient();
        var response = await client.GetAsync("/api/health");
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    /// <summary>Factory that injects a fake Application Insights connection string to exercise the telemetry-enabled code path.</summary>
    private sealed class TelemetryEnabledApplicationFactory : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            builder.ConfigureAppConfiguration(config =>
                config.AddInMemoryCollection(new Dictionary<string, string?>(StringComparer.Ordinal)
                {
                    ["AmbientWeather:ApplicationKey"] = "test-application-key",
                    ["AzureMonitor:ConnectionString"] =
                        "InstrumentationKey=00000000-0000-0000-0000-000000000000",
                }));
            builder.ConfigureTestServices(_ => { });
        }
    }
}
