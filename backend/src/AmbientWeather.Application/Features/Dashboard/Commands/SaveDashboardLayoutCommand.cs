using AmbientWeather.Application.DTOs.Dashboard;
using MediatR;

namespace AmbientWeather.Application.Features.Dashboard.Commands;

/// <summary>
/// Validates and persists the user's dashboard tile layout.
/// </summary>
public sealed record SaveDashboardLayoutCommand : IRequest<DashboardLayoutDto>
{
    /// <summary>Initializes a default-mode save command for model binding.</summary>
    public SaveDashboardLayoutCommand()
    {
    }

    /// <summary>Initializes a default-mode save command with dashboard tiles.</summary>
    /// <param name="tiles">Ordered list of tile configurations to save.</param>
    public SaveDashboardLayoutCommand(IReadOnlyList<DashboardTileDto> tiles)
    {
        Tiles = tiles;
    }

    /// <summary>Layout mode: default or custom.</summary>
    public string LayoutMode { get; init; } = "default";

    /// <summary>Ordered list of default dashboard tile configurations to save.</summary>
    public IReadOnlyList<DashboardTileDto> Tiles { get; init; } = [];

    /// <summary>Ordered settings-managed custom layout items to save.</summary>
    public IReadOnlyList<CustomLayoutItemDto> CustomItems { get; init; } = [];
}
