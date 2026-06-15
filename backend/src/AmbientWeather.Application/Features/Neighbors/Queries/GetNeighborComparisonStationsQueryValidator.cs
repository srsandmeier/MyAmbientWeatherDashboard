using AmbientWeather.Application.Common;
using FluentValidation;

namespace AmbientWeather.Application.Features.Neighbors.Queries;

/// <summary>Validates <see cref="GetNeighborComparisonStationsQuery"/>.</summary>
public sealed class GetNeighborComparisonStationsQueryValidator : AbstractValidator<GetNeighborComparisonStationsQuery>
{
    /// <summary>Initializes a new instance of <see cref="GetNeighborComparisonStationsQueryValidator"/>.</summary>
    public GetNeighborComparisonStationsQueryValidator()
    {
        When(x => x.MacAddress is not null, () =>
        {
            RuleFor(x => x.MacAddress!)
                .Must(MacAddressValidator.IsValid)
                .WithMessage("MacAddress must be a valid 6-byte MAC address.");
        });
    }
}
