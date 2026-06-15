namespace AmbientWeather.Application.Interfaces;

/// <summary>
/// Reads per-user weather stations and credentials that are eligible for history synchronization.
/// </summary>
public interface IHistorySyncTargetRepository
{
    /// <summary>
    /// Gets enabled station targets with decrypted Ambient Weather credentials.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>The targets to synchronize.</returns>
    Task<IReadOnlyList<HistorySyncTarget>> GetEnabledTargetsAsync(
        CancellationToken cancellationToken = default);
}
