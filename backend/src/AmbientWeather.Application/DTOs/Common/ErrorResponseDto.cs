namespace AmbientWeather.Application.DTOs.Common;

/// <summary>
/// Standard error response format for API errors.
/// Shared across API and tests.
/// </summary>
public record ErrorResponseDto
{
    /// <summary>
    /// Brief error code or category.
    /// </summary>
    public required string Error { get; init; }

    /// <summary>
    /// Detailed error message for the client.
    /// </summary>
    public required string Message { get; init; }

    /// <summary>
    /// HTTP status code.
    /// </summary>
    public int StatusCode { get; init; }

    /// <summary>
    /// Optional error details for debugging (only in development).
    /// </summary>
    public string? Details { get; init; }
}
