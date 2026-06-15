using FluentValidation;

namespace AmbientWeather.Application.Features.Dashboard.Queries;

/// <summary>
/// Validator for <see cref="GetDashboardLayoutQuery"/>.
/// No parameters; authenticated user context is resolved in the handler.
/// </summary>
public sealed class GetDashboardLayoutQueryValidator : AbstractValidator<GetDashboardLayoutQuery>
{
    /// <summary>Initializes the validator.</summary>
    public GetDashboardLayoutQueryValidator()
    {
        // No explicit rules; handler enforces authenticated user context.
    }
}
