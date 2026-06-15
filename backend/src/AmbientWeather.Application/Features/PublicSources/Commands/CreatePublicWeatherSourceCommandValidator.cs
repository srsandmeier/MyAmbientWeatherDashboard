using FluentValidation;
using AmbientWeather.Domain.Metrics;

namespace AmbientWeather.Application.Features.PublicSources.Commands;

/// <summary>
/// Validates <see cref="CreatePublicWeatherSourceCommand"/>.
/// </summary>
public sealed class CreatePublicWeatherSourceCommandValidator
    : AbstractValidator<CreatePublicWeatherSourceCommand>
{
    private const int MaxSourceIdLength = 128;
    private const int MaxDisplayLabelLength = 128;
    private const int MaxTimezoneLength = 64;
    private const int MaxMetricKeys = 50;
    private const int MaxMetricKeyLength = 64;

    /// <summary>
    /// Initializes validation rules.
    /// </summary>
    public CreatePublicWeatherSourceCommandValidator()
    {
        RuleFor(x => x.Provider)
            .NotEmpty()
            .Must(p => PublicWeatherSourceProviders.All.Contains(p, StringComparer.Ordinal))
            .WithMessage($"Provider must be one of: {string.Join(", ", PublicWeatherSourceProviders.All)}.");

        RuleFor(x => x.SourceId)
            .NotEmpty()
            .MaximumLength(MaxSourceIdLength)
            .WithMessage($"SourceId must be {MaxSourceIdLength} characters or fewer.");

        RuleFor(x => x.DisplayLabel)
            .NotEmpty()
            .MaximumLength(MaxDisplayLabelLength)
            .WithMessage($"DisplayLabel must be {MaxDisplayLabelLength} characters or fewer.");

        RuleFor(x => x.Latitude)
            .InclusiveBetween(-90, 90)
            .WithMessage("Latitude must be between -90 and 90.");

        RuleFor(x => x.Longitude)
            .InclusiveBetween(-180, 180)
            .WithMessage("Longitude must be between -180 and 180.");

        RuleFor(x => x.Timezone)
            .MaximumLength(MaxTimezoneLength)
            .WithMessage($"Timezone must be {MaxTimezoneLength} characters or fewer.")
            .When(x => x.Timezone is not null);

        RuleFor(x => x.SelectedMetricKeys)
            .Must(keys => keys!.Count <= MaxMetricKeys)
            .WithMessage($"No more than {MaxMetricKeys} metric keys may be selected.")
            .Must(keys => keys!.All(k => k.Length <= MaxMetricKeyLength))
            .WithMessage($"Each metric key must be {MaxMetricKeyLength} characters or fewer.")
            .Must(keys => keys!.All(MetricRegistry.IsSupported))
            .WithMessage("One or more metric keys are not recognised.")
            .When(x => x.SelectedMetricKeys is not null);
    }
}
