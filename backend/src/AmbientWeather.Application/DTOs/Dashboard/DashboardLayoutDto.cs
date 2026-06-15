namespace AmbientWeather.Application.DTOs.Dashboard;

/// <summary>
/// User's active dashboard grid layout with all tile configurations.
/// </summary>
public sealed record DashboardLayoutDto
{
    /// <summary>Layout row identifier.</summary>
    public required Guid Id { get; init; }

    /// <summary>User-visible layout name.</summary>
    public required string Name { get; init; }

    /// <summary>Layout mode: default or custom.</summary>
    public required string LayoutMode { get; init; }

    /// <summary>All tiles in this layout.</summary>
    public required IReadOnlyList<DashboardTileDto> Tiles { get; init; }

    /// <summary>Settings-managed custom layout items.</summary>
    public IReadOnlyList<CustomLayoutItemDto> CustomItems { get; init; } = [];

    /// <summary>UTC timestamp of the last layout save.</summary>
    public required DateTime UpdatedAtUtc { get; init; }
}
