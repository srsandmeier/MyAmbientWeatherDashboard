using FluentValidation;
using AmbientWeather.Domain.Metrics;
using AmbientWeather.Domain.Neighbors;

namespace AmbientWeather.Application.Features.Neighbors.Commands;

/// <summary>
/// Validates <see cref="UpdateNeighborConfigCommand"/>.
/// </summary>
public sealed class UpdateNeighborConfigCommandValidator
    : AbstractValidator<UpdateNeighborConfigCommand>
{
    private const int MaxPinnedSourceIdLength = 128;
    private const int MaxPinnedDisplayLabelLength = 128;
    private const int MaxEnabledStationCount = 50;
    private const int MaxStationMacLength = 64;
    private const int MaxMetricKeys = 50;
    private const int MaxMetricKeyLength = 64;
    private static readonly string AllowedProvidersMessage =
        $"Each enabled provider must be one of: {string.Join(", ", NeighborProviders.All)}.";

    /// <summary>
    /// Initializes a new instance and configures validation rules.
    /// </summary>
    public UpdateNeighborConfigCommandValidator()
    {
        RuleFor(x => x.RadiusMiles)
            .InclusiveBetween(5, 50)
            .WithMessage("RadiusMiles must be between 5 and 50.");

        RuleFor(x => x.ComparisonRadiusMiles)
            .InclusiveBetween(0.5, 34)
            .WithMessage("ComparisonRadiusMiles must be between 0.5 and 34.")
            .When(x => x.ComparisonRadiusMiles is not null);

        RuleFor(x => x.MaxAgeMinutes)
            .InclusiveBetween(5, 120)
            .WithMessage("MaxAgeMinutes must be between 5 and 120.");

        RuleFor(x => x.MinStations)
            .InclusiveBetween(1, 50)
            .WithMessage("MinStations must be between 1 and 50.");

        RuleFor(x => x.RefreshIntervalMinutes)
            .InclusiveBetween(5, 60)
            .WithMessage("RefreshIntervalMinutes must be between 5 and 60.");

        RuleFor(x => x.DiscoveryLocationQuery)
            .MaximumLength(128)
            .WithMessage("DiscoveryLocationQuery must be 128 characters or fewer.")
            .When(x => x.DiscoveryLocationQuery is not null);

        RuleForEach(x => x.EnabledProviders)
            .Must(p => NeighborProviders.All.Contains(p, StringComparer.Ordinal))
            .WithMessage(AllowedProvidersMessage);

        RuleFor(x => x.EnabledStationMacAddresses)
            .Must(list => list is null || list.Count <= MaxEnabledStationCount)
            .WithMessage($"No more than {MaxEnabledStationCount} owned stations may enable neighbor comparison.")
            .When(x => x.EnabledStationMacAddresses is not null);

        RuleForEach(x => x.EnabledStationMacAddresses)
            .NotEmpty()
            .MaximumLength(MaxStationMacLength)
            .WithMessage($"Station MAC addresses must be {MaxStationMacLength} characters or fewer.")
            .When(x => x.EnabledStationMacAddresses is not null);

        RuleFor(x => x.Municipality)
            .MaximumLength(128)
            .WithMessage("Municipality must be 128 characters or fewer.")
            .When(x => x.Municipality is not null);

        RuleFor(x => x.PinnedStations)
            .Must(list => list is null || list.Count <= 10)
            .WithMessage("No more than 10 stations may be pinned.")
            .When(x => x.PinnedStations is not null);

        RuleForEach(x => x.PinnedStations)
            .ChildRules(ConfigurePinnedStationRules)
            .When(x => x.PinnedStations is not null);
    }

    private static void ConfigurePinnedStationRules(InlineValidator<PinnedNeighborStation> station)
    {
        station.RuleFor(x => x.Provider)
            .NotEmpty()
            .Must(p => NeighborProviders.All.Contains(p, StringComparer.Ordinal))
            .WithMessage($"Pinned station provider must be one of: {string.Join(", ", NeighborProviders.All)}.");

        station.RuleFor(x => x.SourceId)
            .NotEmpty()
            .MaximumLength(MaxPinnedSourceIdLength)
            .WithMessage($"Pinned station source id must be {MaxPinnedSourceIdLength} characters or fewer.");

        station.RuleFor(x => x.DisplayLabel)
            .MaximumLength(MaxPinnedDisplayLabelLength)
            .WithMessage($"Pinned station display label must be {MaxPinnedDisplayLabelLength} characters or fewer.")
            .When(x => x.DisplayLabel is not null);

        station.RuleFor(x => x.SelectedMetricKeys)
            .Must(keys => keys!.Count <= MaxMetricKeys)
            .WithMessage($"No more than {MaxMetricKeys} metric keys may be selected.")
            .Must(keys => keys!.All(k => k.Length <= MaxMetricKeyLength))
            .WithMessage($"Each metric key must be {MaxMetricKeyLength} characters or fewer.")
            .Must(keys => keys!.All(MetricRegistry.IsSupported))
            .WithMessage("One or more pinned station metric keys are not recognised.")
            .When(x => x.SelectedMetricKeys is not null);
    }
}
