using FluentValidation;

namespace AmbientWeather.Application.Features.Dashboard.Queries;

/// <summary>
/// Validator for <see cref="GetCurrentReadingQuery"/>.
/// This query carries no parameters (authenticated user context is resolved in the handler),
/// so validation is minimal. The validator is registered for consistency with the CQRS pattern.
/// </summary>
public sealed class GetCurrentReadingQueryValidator : AbstractValidator<GetCurrentReadingQuery>
{
    /// <summary>Initializes the validator.</summary>
    public GetCurrentReadingQueryValidator()
    {
        // No explicit rules needed; the handler validates authenticated user context.
    }
}
