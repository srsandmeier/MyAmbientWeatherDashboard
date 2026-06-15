using AmbientWeather.Application.DTOs.Dashboard;
using FluentValidation;

namespace AmbientWeather.Application.Features.Dashboard.Commands;

internal sealed class CustomLayoutItemValidator : AbstractValidator<CustomLayoutItemDto>
{
    private static readonly HashSet<string> ValidCustomItemTypes =
        new(["metric-block", "divider", "header-ticker", "footer-ticker"], StringComparer.OrdinalIgnoreCase);

    private static readonly HashSet<string> ValidCustomTileSizes =
        new(["1x1", "1x2", "1x3", "2x1", "2x2", "2x3", "3x1", "3x2", "3x3"], StringComparer.OrdinalIgnoreCase);

    private static readonly HashSet<string> ValidMetricBlockDisplayModes =
        new(["rows", "fill"], StringComparer.OrdinalIgnoreCase);

    private static readonly HashSet<string> ValidTickerPositions =
        new(["header", "footer"], StringComparer.OrdinalIgnoreCase);

    public CustomLayoutItemValidator()
    {
        RuleFor(i => i.Id).NotEmpty().WithMessage("Custom layout item id must not be empty.");
        RuleFor(i => i.Type)
            .NotEmpty()
            .Must(type => ValidCustomItemTypes.Contains(type))
            .WithMessage("Custom layout item type must be 'metric-block', 'divider', 'header-ticker', or 'footer-ticker'.");
        RuleFor(i => i.Size)
            .NotEmpty()
            .Must(size => ValidCustomTileSizes.Contains(size))
            .WithMessage("Custom layout item size must fit the 3-column grid.");

        AddMetricBlockRules();
        AddDividerRules();
        AddTickerRules();
    }

    private void AddMetricBlockRules()
    {
        When(i => i.Type.Equals("metric-block", StringComparison.OrdinalIgnoreCase), () =>
        {
            RuleFor(i => i.DisplayMode)
                .NotEmpty()
                .Must(mode => mode is not null && ValidMetricBlockDisplayModes.Contains(mode))
                .WithMessage("Metric block displayMode must be 'rows' or 'fill'.");

            RuleFor(i => i.Metrics)
                .Must(m => m.Count <= 10)
                .WithMessage("A metric block may contain at most 10 metrics.");

            RuleForEach(i => i.Metrics).SetValidator(new CustomMetricReferenceValidator());

            When(i => i.DisplayMode is not null
                      && i.DisplayMode.Equals("fill", StringComparison.OrdinalIgnoreCase), () =>
            {
                RuleFor(i => i)
                    .Must(i => i.Metrics.Count >= 1 && i.Metrics.Count <= FillCapacity(i.Size))
                    .WithMessage(i =>
                        $"Fill tile mode for a {i.Size} block requires 1 to {FillCapacity(i.Size)} metric(s).");
            });
        });
    }

    /// <summary>Returns the number of 1×1 cells in a tile of the given size string (e.g. "2x3" → 6).</summary>
    private static int FillCapacity(string size) =>
        size is { Length: 3 } && size[1] == 'x'
            ? (size[0] - '0') * (size[2] - '0')
            : 1;

    private void AddDividerRules()
    {
        When(i => i.Type.Equals("divider", StringComparison.OrdinalIgnoreCase), () =>
        {
            RuleFor(i => i.DisplayMode).Null().WithMessage("Divider items must not include a displayMode.");
            RuleFor(i => i.Position).Null().WithMessage("Divider items must not include a position.");
        });
    }

    private static readonly System.Text.RegularExpressions.Regex AlertsZonePattern =
        new(@"^[A-Z0-9/]+$",
            System.Text.RegularExpressions.RegexOptions.Compiled |
            System.Text.RegularExpressions.RegexOptions.NonBacktracking);

    private void AddTickerRules()
    {
        When(i => i.Type.Equals("header-ticker", StringComparison.OrdinalIgnoreCase)
                  || i.Type.Equals("footer-ticker", StringComparison.OrdinalIgnoreCase), () =>
        {
            RuleFor(i => i.Position)
                .NotEmpty()
                .Must(position => position is not null && ValidTickerPositions.Contains(position))
                .WithMessage("Ticker item position must be 'header' or 'footer'.");

            When(i => i.Type.Equals("header-ticker", StringComparison.OrdinalIgnoreCase), () =>
                RuleFor(i => i.Position)
                    .Equal("header", StringComparer.OrdinalIgnoreCase)
                    .WithMessage("Header ticker items must use the header position."));

            When(i => i.Type.Equals("footer-ticker", StringComparison.OrdinalIgnoreCase), () =>
                RuleFor(i => i.Position)
                    .Equal("footer", StringComparer.OrdinalIgnoreCase)
                    .WithMessage("Footer ticker items must use the footer position."));

            When(i => i.ChannelStationId is not null, () =>
                RuleFor(i => i.ChannelStationId)
                    .MaximumLength(256)
                    .WithMessage("Ticker channel station id must not exceed 256 characters."));

            When(i => i.AlertsZone is not null, () =>
                RuleFor(i => i.AlertsZone)
                    .MaximumLength(32)
                    .WithMessage("Ticker alerts zone must not exceed 32 characters.")
                    .Must(z => z is null || AlertsZonePattern.IsMatch(z))
                    .WithMessage("Ticker alerts zone must contain only uppercase letters, digits, and '/'.")
            );
        });
    }
}
