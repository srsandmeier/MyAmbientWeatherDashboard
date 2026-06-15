using AmbientWeather.Domain.Entities;

namespace AmbientWeather.Application.Interfaces;

/// <summary>
/// Persists public weather sources selected by authenticated users.
/// </summary>
public interface IPublicWeatherSourceStore
{
    /// <summary>
    /// Returns all public weather sources owned by the authenticated user.
    /// </summary>
    Task<IReadOnlyList<PublicWeatherSource>> GetAllAsync(
        string authProviderSubject,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns a single public weather source owned by the authenticated user.
    /// </summary>
    Task<PublicWeatherSource?> GetByIdAsync(
        string authProviderSubject,
        Guid sourceId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Adds a public weather source for the authenticated user, creating the app user row if needed.
    /// </summary>
    Task<PublicWeatherSource> AddAsync(
        string authProviderSubject,
        string? email,
        PublicWeatherSource source,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Saves pending changes to a tracked public weather source.
    /// </summary>
    Task SaveAsync(PublicWeatherSource source, CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes a tracked public weather source.
    /// </summary>
    Task DeleteAsync(PublicWeatherSource source, CancellationToken cancellationToken = default);
}
