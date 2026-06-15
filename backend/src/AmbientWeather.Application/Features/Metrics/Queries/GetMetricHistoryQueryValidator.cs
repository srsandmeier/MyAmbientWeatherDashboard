using System.Globalization;
using AmbientWeather.Application.Common;
using FluentValidation;

namespace AmbientWeather.Application.Features.Metrics.Queries;

/// <summary>
/// Validates <see cref="GetMetricHistoryQuery"/> before the handler runs.
/// Registered automatically by <c>AddValidatorsFromAssembly</c> and executed via <see cref="ValidationBehavior"/>.
/// </summary>
public sealed class GetMetricHistoryQueryValidator : AbstractValidator<GetMetricHistoryQuery>
{
    private static readonly HashSet<string> ValidRanges =
        new(StringComparer.OrdinalIgnoreCase)
        { "24h", "7d", "30d", "90d", "1y", "custom", "date" };

    private static readonly HashSet<string> ValidGranularities =
        new(StringComparer.OrdinalIgnoreCase)
        { "auto", "raw", "hour", "day" };

    private static readonly TimeSpan MaxCustomRange = TimeSpan.FromDays(366);

    /// <summary>
    /// Initializes validation rules.
    /// </summary>
    public GetMetricHistoryQueryValidator()
    {
        RuleFor(x => x.MetricKey)
            .NotEmpty().WithMessage("Metric key is required.")
            .Must(HistoryMetricMap.IsSupported)
            .WithMessage(q => $"Metric key '{q.MetricKey}' is not supported.");

        RuleFor(x => x.Range)
            .NotEmpty().WithMessage("Range is required.")
            .Must(r => r != null && ValidRanges.Contains(r))
            .WithMessage("Range must be one of: 24h, 7d, 30d, 90d, 1y, custom, date.");

        RuleFor(x => x.Granularity)
            .Must(g => g == null || ValidGranularities.Contains(g))
            .WithMessage("Granularity must be one of: auto, raw, hour, day.");

        RuleFor(x => x.Source)
            .Must(s => s == null || string.Equals(s, "my", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Only 'my' stations are supported. Neighbour data is not yet available.");

        RuleFor(x => x.DeviceId)
            .Must(mac => mac == null || MacAddressValidator.IsValid(mac))
            .WithMessage("Device ID must be a valid MAC address.");

        When(x => string.Equals(x.Range, "custom", StringComparison.OrdinalIgnoreCase), () =>
        {
            RuleFor(x => x.From)
                .NotEmpty().WithMessage("'from' is required for custom range.")
                .Must(BeValidDateTime).WithMessage("'from' must be a valid ISO date/time.");

            RuleFor(x => x.To)
                .NotEmpty().WithMessage("'to' is required for custom range.")
                .Must(BeValidDateTime).WithMessage("'to' must be a valid ISO date/time.");

            RuleFor(x => x)
                .Must(q => RangeOrderIsValid(q.From, q.To))
                .WithName("from/to")
                .WithMessage("'from' must be earlier than 'to'.")
                .Must(q => RangeSpanIsWithinLimit(q.From, q.To))
                .WithName("from/to")
                .WithMessage($"Custom range cannot exceed {(int)MaxCustomRange.TotalDays} days.");
        });

        When(x => string.Equals(x.Range, "date", StringComparison.OrdinalIgnoreCase), () =>
        {
            RuleFor(x => x.Date)
                .NotEmpty().WithMessage("'date' is required for date mode.")
                .Must(BeValidDateOnly).WithMessage("'date' must be in YYYY-MM-DD format.");
        });
    }

    private static bool BeValidDateTime(string? value) =>
        DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out _);

    private static bool BeValidDateOnly(string? value) =>
        DateTime.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _);

    private static bool RangeOrderIsValid(string? from, string? to)
    {
        if (!DateTime.TryParse(from, CultureInfo.InvariantCulture, DateTimeStyles.None, out var f)) return true;
        if (!DateTime.TryParse(to, CultureInfo.InvariantCulture, DateTimeStyles.None, out var t)) return true;
        return f < t;
    }

    private static bool RangeSpanIsWithinLimit(string? from, string? to)
    {
        if (!DateTime.TryParse(from, CultureInfo.InvariantCulture, DateTimeStyles.None, out var f)) return true;
        if (!DateTime.TryParse(to, CultureInfo.InvariantCulture, DateTimeStyles.None, out var t)) return true;
        return t - f <= MaxCustomRange;
    }
}
