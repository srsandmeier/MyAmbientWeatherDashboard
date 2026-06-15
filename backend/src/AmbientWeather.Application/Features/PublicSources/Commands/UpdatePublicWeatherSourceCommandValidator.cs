using FluentValidation;
using AmbientWeather.Domain.Metrics;

namespace AmbientWeather.Application.Features.PublicSources.Commands;

/// <summary>
/// Validates <see cref="UpdatePublicWeatherSourceCommand"/>.
/// </summary>
public sealed class UpdatePublicWeatherSourceCommandValidator
    : AbstractValidator<UpdatePublicWeatherSourceCommand>
{
    private const int MaxDisplayLabelLength = 128;
    private const int MaxMetricKeys = 50;
    private const int MaxMetricKeyLength = 64;

    /// <summary>
    /// Initializes validation rules.
    /// </summary>
    public UpdatePublicWeatherSourceCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty();

        RuleFor(x => x.DisplayLabel)
            .NotEmpty()
            .MaximumLength(MaxDisplayLabelLength)
            .WithMessage($"DisplayLabel must be {MaxDisplayLabelLength} characters or fewer.")
            .When(x => x.DisplayLabel is not null);

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
