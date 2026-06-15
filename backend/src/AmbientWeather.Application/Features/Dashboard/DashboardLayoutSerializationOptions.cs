using System.Text.Json;

namespace AmbientWeather.Application.Features.Dashboard;

/// <summary>Shared JSON serialization options for dashboard layout persistence.</summary>
internal static class DashboardLayoutSerializationOptions
{
    /// <summary>The single instance shared by layout read and write handlers.</summary>
    internal static readonly JsonSerializerOptions Instance = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };
}
