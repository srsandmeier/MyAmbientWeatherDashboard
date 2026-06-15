using FluentValidation;

namespace AmbientWeather.Application.Features.Settings.Commands;

/// <summary>
/// Validates <see cref="UpdateUserPreferencesCommand"/> field values against the allowed sets
/// defined in the data model.
/// </summary>
public sealed class UpdateUserPreferencesCommandValidator : AbstractValidator<UpdateUserPreferencesCommand>
{
    /// <summary>
    /// Initializes a new instance of <see cref="UpdateUserPreferencesCommandValidator"/>.
    /// </summary>
    public UpdateUserPreferencesCommandValidator()
    {
        RuleFor(x => x.TemperatureUnit)
            .NotEmpty()
            .Must(v => v is "F" or "C")
            .WithMessage("TemperatureUnit must be 'F' or 'C'.");

        RuleFor(x => x.SpeedUnit)
            .NotEmpty()
            .Must(v => v is "mph" or "kmh" or "ms")
            .WithMessage("SpeedUnit must be 'mph', 'kmh', or 'ms'.");

        RuleFor(x => x.PressureUnit)
            .NotEmpty()
            .Must(v => v is "inhg" or "hpa" or "mbar")
            .WithMessage("PressureUnit must be 'inhg', 'hpa', or 'mbar'.");

        RuleFor(x => x.RainfallUnit)
            .NotEmpty()
            .Must(v => v is "in" or "mm")
            .WithMessage("RainfallUnit must be 'in' or 'mm'.");

        RuleFor(x => x.DistanceUnit)
            .NotEmpty()
            .Must(v => v is "mi" or "km")
            .WithMessage("DistanceUnit must be 'mi' or 'km'.");

        RuleFor(x => x.Theme)
            .NotEmpty()
            .Must(v => v is "light" or "dark" or "system")
            .WithMessage("Theme must be 'light', 'dark', or 'system'.");

        RuleFor(x => x.DateFormat)
            .NotEmpty()
            .Must(v => v is "mdy" or "dmy" or "iso")
            .WithMessage("DateFormat must be 'mdy', 'dmy', or 'iso'.");

        RuleFor(x => x.TemperatureDecimals)
            .Must(v => v is 0 or 1 or 2)
            .WithMessage("TemperatureDecimals must be 0, 1, or 2.");

        RuleFor(x => x.DailyExtremaTimezone)
            .NotEmpty()
            .Must(v => v is "utc" or "local")
            .WithMessage("DailyExtremaTimezone must be 'utc' or 'local'.");
    }
}
