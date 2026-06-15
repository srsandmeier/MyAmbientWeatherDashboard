using AmbientWeather.Application.DTOs.Realtime;
using AmbientWeather.Domain.Entities;

namespace AmbientWeather.Application.Interfaces;

/// <summary>
/// Resolves current readings for user-selected public weather sources.
/// </summary>
public interface IPublicSourceCurrentReadingService
{
    /// <summary>
    /// Returns the current reading for a selected public weather source.
    /// </summary>
    Task<CurrentReadingDto> GetCurrentAsync(
        string userHash,
        PublicWeatherSource source,
        CancellationToken cancellationToken = default);
}
