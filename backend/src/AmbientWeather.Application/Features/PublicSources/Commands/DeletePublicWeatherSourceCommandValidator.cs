using FluentValidation;

namespace AmbientWeather.Application.Features.PublicSources.Commands;

/// <summary>
/// Validates <see cref="DeletePublicWeatherSourceCommand"/>.
/// </summary>
public sealed class DeletePublicWeatherSourceCommandValidator
    : AbstractValidator<DeletePublicWeatherSourceCommand>
{
    /// <summary>
    /// Initializes validation rules.
    /// </summary>
    public DeletePublicWeatherSourceCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty();
    }
}
