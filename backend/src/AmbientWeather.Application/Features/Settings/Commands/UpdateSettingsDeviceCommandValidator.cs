using AmbientWeather.Application.Common;
using AmbientWeather.Domain.Metrics;
using FluentValidation;

namespace AmbientWeather.Application.Features.Settings.Commands;

/// <summary>
/// Validates <see cref="UpdateSettingsDeviceCommand"/> inputs.
/// </summary>
public sealed class UpdateSettingsDeviceCommandValidator : AbstractValidator<UpdateSettingsDeviceCommand>
{
    /// <summary>
    /// Initializes validation rules.
    /// </summary>
    public UpdateSettingsDeviceCommandValidator()
    {
        RuleFor(x => x.MacAddress)
            .NotEmpty().WithMessage("MAC address is required.")
            .Must(MacAddressValidator.IsValid).WithMessage("MAC address format is invalid.");

        RuleFor(x => x.Nickname)
            .MaximumLength(128).WithMessage("Nickname must not exceed 128 characters.")
            .When(x => x.Nickname != null);

        RuleFor(x => x.SelectedMetricKeys)
            .Must(keys => keys!.Count <= 50)
            .WithMessage("No more than 50 metric keys may be selected.")
            .Must(keys => keys!.All(k => k.Length <= 64))
            .WithMessage("Each metric key must not exceed 64 characters.")
            .Must(keys => keys!.All(k => MetricRegistry.IsSupported(k)))
            .WithMessage("One or more metric keys are not recognised.")
            .When(x => x.SelectedMetricKeys != null);
    }
}
