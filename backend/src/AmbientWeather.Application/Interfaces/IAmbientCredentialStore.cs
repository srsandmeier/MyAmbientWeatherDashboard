namespace AmbientWeather.Application.Interfaces;

/// <summary>
/// Stores and retrieves encrypted Ambient Weather credentials for authenticated users.
/// </summary>
public interface IAmbientCredentialStore
{
    /// <summary>
    /// Saves or replaces Ambient Weather credentials for the authenticated user subject.
    /// </summary>
    /// <param name="authProviderSubject">The authenticated provider subject claim.</param>
    /// <param name="email">The user's email address when available.</param>
    /// <param name="apiKey">The Ambient Weather user API key.</param>
    /// <param name="applicationKey">The Ambient Weather application key.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>A task that completes when credentials are saved.</returns>
    Task SaveAsync(
        string authProviderSubject,
        string? email,
        string apiKey,
        string applicationKey,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets decrypted Ambient Weather credentials for the authenticated user subject.
    /// </summary>
    /// <param name="authProviderSubject">The authenticated provider subject claim.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>The decrypted credentials, or <see langword="null" /> when none are stored.</returns>
    Task<AmbientCredentials?> GetAsync(
        string authProviderSubject,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes stored Ambient Weather credentials for the authenticated user subject.
    /// </summary>
    /// <param name="authProviderSubject">The authenticated provider subject claim.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>A task that completes when credentials are deleted.</returns>
    Task DeleteAsync(
        string authProviderSubject,
        CancellationToken cancellationToken = default);
}
