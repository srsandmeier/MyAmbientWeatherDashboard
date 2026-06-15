using AmbientWeather.Application.Common;
using FluentValidation;

namespace AmbientWeather.Application.Features.DeviceHistory.Queries;

/// <summary>
/// Validates a <see cref="GetDeviceHistoryQuery"/> before it reaches the handler.
/// </summary>
public sealed class GetDeviceHistoryQueryValidator : AbstractValidator<GetDeviceHistoryQuery>
{
    /// <summary>
    /// Initializes validation rules for <see cref="GetDeviceHistoryQuery"/>.
    /// </summary>
    public GetDeviceHistoryQueryValidator()
    {
        RuleFor(q => q.MacAddress)
            .Must(MacAddressValidator.IsValid)
            .WithMessage("MAC address must be in format XX:XX:XX:XX:XX:XX, XX-XX-XX-XX-XX-XX, or XXXXXXXXXXXX.");

        RuleFor(q => q.Limit)
            .InclusiveBetween(1, 288)
            .WithMessage("Limit must be between 1 and 288.");

        RuleFor(q => q.EndDate)
            .Must(d => d == null || d.Value.Date <= DateTime.UtcNow.Date)
            .WithMessage("EndDate cannot be in the future.");
    }
}
