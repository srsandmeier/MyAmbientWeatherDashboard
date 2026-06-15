using AmbientWeather.Domain.Entities;

namespace AmbientWeather.Application.Interfaces;

/// <summary>
/// Retrieves and persists <see cref="UserPreferences"/> for authenticated users.
/// </summary>
public interface IUserPreferencesStore
{
    /// <summary>
    /// Returns the preferences for the given user, creating a row with defaults when none exists.
    /// </summary>
    /// <param name="authProviderSubject">The authenticated provider subject claim.</param>
    /// <param name="email">The user's email address when available.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>The user's preferences (never null).</returns>
    Task<UserPreferences> GetOrCreateAsync(
        string authProviderSubject,
        string? email,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Persists changes to the provided preferences entity.
    /// </summary>
    /// <param name="preferences">The preferences entity with updated values.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>A task that completes when the changes are saved.</returns>
    Task SaveAsync(UserPreferences preferences, CancellationToken cancellationToken = default);
}
