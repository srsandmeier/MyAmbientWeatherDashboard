using AmbientWeather.Domain.Neighbors;
using FluentValidation;

namespace AmbientWeather.Application.Features.Neighbors.Queries;

/// <summary>Validates <see cref="GetPinnedStationReadingQuery"/>.</summary>
public sealed class GetPinnedStationReadingQueryValidator : AbstractValidator<GetPinnedStationReadingQuery>
{
    /// <summary>Initializes a new instance of <see cref="GetPinnedStationReadingQueryValidator"/>.</summary>
    public GetPinnedStationReadingQueryValidator()
    {
        RuleFor(x => x.Provider)
            .NotEmpty()
            .MaximumLength(64)
            .Must(p => NeighborProviders.All.Contains(p, StringComparer.Ordinal))
            .WithMessage($"Provider must be one of: {string.Join(", ", NeighborProviders.All)}.");

        RuleFor(x => x.SourceId)
            .NotEmpty()
            .MaximumLength(128);
    }
}
