namespace AmbientWeather.Api.Controllers;

/// <summary>Health check response body.</summary>
/// <param name="Status">Current service status.</param>
public sealed record HealthResponse(string Status);
