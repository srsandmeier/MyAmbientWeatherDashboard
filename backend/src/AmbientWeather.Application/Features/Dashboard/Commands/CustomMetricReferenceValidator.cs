using AmbientWeather.Application.DTOs.Dashboard;
using AmbientWeather.Domain.Metrics;
using FluentValidation;

namespace AmbientWeather.Application.Features.Dashboard.Commands;

internal sealed class CustomMetricReferenceValidator : AbstractValidator<CustomMetricReferenceDto>
{
    public CustomMetricReferenceValidator()
    {
        RuleFor(m => m.StationId)
            .NotEmpty()
            .WithMessage("Custom metric references must specify a stationId.");
        RuleFor(m => m.MetricKey)
            .NotEmpty()
            .Must(key => MetricRegistry.IsSupported(key))
            .WithMessage("Custom metric reference metricKey is not a registered metric.");
    }
}
