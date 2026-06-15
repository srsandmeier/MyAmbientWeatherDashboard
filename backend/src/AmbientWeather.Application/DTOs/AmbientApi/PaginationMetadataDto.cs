using System.Text.Json.Serialization;

namespace AmbientWeather.Application.DTOs.AmbientApi;

/// <summary>
/// Pagination metadata for list responses.
/// </summary>
public record PaginationMetadataDto
{
    /// <summary>Gets the current page number (1-based).</summary>
    [JsonPropertyName("pageNumber")]
    public int PageNumber { get; init; }

    /// <summary>Gets the number of items per page.</summary>
    [JsonPropertyName("pageSize")]
    public int PageSize { get; init; }

    /// <summary>Gets the total number of pages available.</summary>
    [JsonPropertyName("totalPages")]
    public int TotalPages { get; init; }

    /// <summary>Gets a value indicating whether there are more pages available after the current page.</summary>
    [JsonPropertyName("hasNextPage")]
    public bool HasNextPage { get; init; }

    /// <summary>Gets a value indicating whether there are pages before the current page.</summary>
    [JsonPropertyName("hasPreviousPage")]
    public bool HasPreviousPage { get; init; }
}
