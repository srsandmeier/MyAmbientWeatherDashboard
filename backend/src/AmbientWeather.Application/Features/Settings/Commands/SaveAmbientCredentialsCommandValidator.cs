using FluentValidation;

namespace AmbientWeather.Application.Features.Settings.Commands;

/// <summary>
/// Validates <see cref="SaveAmbientCredentialsCommand"/>.
/// </summary>
public sealed class SaveAmbientCredentialsCommandValidator : AbstractValidator<SaveAmbientCredentialsCommand>
{
    /// <summary>
    /// Initializes validation rules for <see cref="SaveAmbientCredentialsCommand"/>.
    /// </summary>
    public SaveAmbientCredentialsCommandValidator()
    {
        RuleFor(command => command.ApiKey)
            .NotEmpty()
            .MaximumLength(512);

        RuleFor(command => command.ApplicationKey)
            .NotEmpty()
            .MaximumLength(512);
    }
}
