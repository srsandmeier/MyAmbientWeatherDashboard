using System.Text.Json;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace AmbientWeather.Api.Controllers;

/// <summary>Writes the stable JSON health check response used by /api/health/live and /api/health/ready.</summary>
internal static class HealthResponseWriter
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    /// <summary>Writes a <see cref="HealthReport"/> as a structured JSON response.</summary>
    /// <param name="context">The current HTTP context.</param>
    /// <param name="report">The health report to serialize.</param>
    public static async Task WriteAsync(HttpContext context, HealthReport report)
    {
        context.Response.ContentType = "application/json; charset=utf-8";
        context.Response.StatusCode = report.Status == HealthStatus.Unhealthy
            ? StatusCodes.Status503ServiceUnavailable
            : StatusCodes.Status200OK;

        var payload = new
        {
            status = report.Status.ToString(),
            checks = report.Entries.Select(e => new
            {
                name = e.Key,
                status = e.Value.Status.ToString(),
                description = e.Value.Description,
                duration = e.Value.Duration.ToString("c"),
            }),
            timestamp = DateTimeOffset.UtcNow,
        };

        await context.Response.WriteAsJsonAsync(payload, JsonOptions).ConfigureAwait(false);
    }
}
