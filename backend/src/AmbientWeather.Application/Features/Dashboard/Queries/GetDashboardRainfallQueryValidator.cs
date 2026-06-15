using FluentValidation;

namespace AmbientWeather.Application.Features.Dashboard.Queries;

/// <summary>
/// Validator for <see cref="GetDashboardRainfallQuery"/>.
/// This query carries no parameters; authenticated user context is resolved in the handler.
/// </summary>
public sealed class GetDashboardRainfallQueryValidator : AbstractValidator<GetDashboardRainfallQuery>
{
    /// <summary>Initializes the validator.</summary>
    public GetDashboardRainfallQueryValidator()
    {
        // No explicit rules; handler enforces authenticated user and precondition checks.
    }
}
