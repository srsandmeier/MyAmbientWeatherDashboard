using AmbientWeather.Application.DTOs.Dashboard;
using AmbientWeather.Domain.Metrics;
using FluentValidation;

namespace AmbientWeather.Application.Features.Dashboard.Commands;

/// <summary>
/// Validates <see cref="SaveDashboardLayoutCommand"/> before the handler executes.
/// Checks tile structure, uniqueness, dimensions, type, and metric key registry membership.
/// </summary>
public sealed class SaveDashboardLayoutCommandValidator : AbstractValidator<SaveDashboardLayoutCommand>
{
    private static readonly HashSet<string> ValidLayoutModes =
        new(["default", "custom"], StringComparer.OrdinalIgnoreCase);

    private static readonly HashSet<string> ValidTypes =
        new(["metric", "temperature", "humidity", "wind", "solar", "conditions", "rainfall", "status"], StringComparer.OrdinalIgnoreCase);

    private static readonly HashSet<string> GroupTypes =
        new(["temperature", "humidity", "wind", "solar", "conditions"], StringComparer.OrdinalIgnoreCase);

    /// <summary>Initializes the validator with all tile-level rules.</summary>
    public SaveDashboardLayoutCommandValidator()
    {
        RuleFor(c => c.LayoutMode)
            .NotEmpty()
            .Must(mode => ValidLayoutModes.Contains(mode))
            .WithMessage("Layout mode must be 'default' or 'custom'.");

        AddDefaultTileRules();
        AddCustomItemRules();
    }

    private void AddDefaultTileRules()
    {
        RuleFor(c => c.Tiles)
            .NotNull()
            .Must(t => t.Count <= 20)
            .WithMessage("A layout may contain at most 20 tiles.")
            .Must(HaveUniqueTileIds)
            .WithMessage("All tile identifiers (i) must be unique within the layout.");

        RuleForEach(c => c.Tiles).ChildRules(tile =>
        {
            tile.RuleFor(t => t.I).NotEmpty().WithMessage("Tile identifier (i) must not be empty.");

            tile.RuleFor(t => t.W).GreaterThanOrEqualTo(1).WithMessage("Tile width (w) must be ≥ 1.");
            tile.RuleFor(t => t.H).GreaterThanOrEqualTo(1).WithMessage("Tile height (h) must be ≥ 1.");
            tile.RuleFor(t => t.X).GreaterThanOrEqualTo(0).WithMessage("Tile x must be ≥ 0.");
            tile.RuleFor(t => t.Y).GreaterThanOrEqualTo(0).WithMessage("Tile y must be ≥ 0.");

            tile.RuleFor(t => t.Type)
                .NotEmpty()
                .Must(ty => ValidTypes.Contains(ty))
                .WithMessage("Tile type must be 'metric', 'rainfall', or 'status'.");

            tile.When(t => "metric".Equals(t.Type, StringComparison.OrdinalIgnoreCase), () =>
            {
                tile.RuleFor(t => t.MetricKey)
                    .NotEmpty()
                    .WithMessage("Metric tiles must specify a metricKey.")
                    .Must(key => MetricRegistry.IsSupported(key))
                    .WithMessage("metricKey is not a registered metric.");

                tile.RuleFor(t => t.DeviceId)
                    .NotEmpty()
                    .WithMessage("Metric tiles must specify a deviceId.");
            });

            tile.When(t => GroupTypes.Contains(t.Type), () =>
            {
                tile.RuleFor(t => t.DeviceId)
                    .NotEmpty()
                    .WithMessage("Group tiles must specify a deviceId.");

                tile.RuleFor(t => t.MetricKey)
                    .Null()
                    .WithMessage("Group tiles must not include a metricKey.");
            });

            tile.When(
                t => !"metric".Equals(t.Type, StringComparison.OrdinalIgnoreCase) && !GroupTypes.Contains(t.Type),
                () =>
                {
                    tile.RuleFor(t => t.MetricKey)
                        .Null()
                        .WithMessage("Non-metric tiles must not include a metricKey.");
                });
        });
    }

    private void AddCustomItemRules()
    {
        RuleFor(c => c.CustomItems)
            .NotNull()
            .Must(items => items.Count <= 12)
            .WithMessage("A custom layout may contain at most 12 items.")
            .Must(HaveUniqueCustomItemIds)
            .WithMessage("All custom layout item identifiers must be unique within the layout.");

        RuleForEach(c => c.CustomItems).SetValidator(new CustomLayoutItemValidator());
    }

    private static bool HaveUniqueTileIds(IReadOnlyList<DashboardTileDto> tiles)
    {
        var ids = tiles.Select(t => t.I).ToList();
        return ids.Count == ids.Distinct(StringComparer.OrdinalIgnoreCase).Count();
    }

    private static bool HaveUniqueCustomItemIds(IReadOnlyList<CustomLayoutItemDto> items)
    {
        var ids = items.Select(i => i.Id).ToList();
        return ids.Count == ids.Distinct(StringComparer.OrdinalIgnoreCase).Count();
    }
}
