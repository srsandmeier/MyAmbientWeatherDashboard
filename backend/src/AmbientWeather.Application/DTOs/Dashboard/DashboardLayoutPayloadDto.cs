namespace AmbientWeather.Application.DTOs.Dashboard;

/// <summary>
/// Persisted JSON payload for a user's active dashboard layout.
/// </summary>
public sealed record DashboardLayoutPayloadDto
{
    /// <summary>Layout mode: default or custom.</summary>
    public string LayoutMode { get; init; } = "default";

    /// <summary>Default dashboard tiles.</summary>
    public IReadOnlyList<DashboardTileDto> Tiles { get; init; } = [];

    /// <summary>Settings-managed custom layout items.</summary>
    public IReadOnlyList<CustomLayoutItemDto> CustomItems { get; init; } = [];
}
