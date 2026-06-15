using AmbientWeather.Domain.Entities;

namespace AmbientWeather.Application.Interfaces;

/// <summary>
/// Persists and retrieves the user's active dashboard layout.
/// Each user has at most one active layout at a time (enforced by a filtered unique index).
/// </summary>
public interface IDashboardLayoutStore
{
    /// <summary>
    /// Returns the user's currently active <see cref="DashboardLayout"/>,
    /// or <see langword="null"/> when no active layout exists.
    /// </summary>
    Task<DashboardLayout?> GetActiveAsync(
        string authProviderSubject,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates or updates the user's single active layout, replacing its stored JSON.
    /// When no active layout exists a new row is inserted; when one exists it is updated in place.
    /// </summary>
    /// <returns>The persisted <see cref="DashboardLayout"/> after save.</returns>
    Task<DashboardLayout> UpsertActiveAsync(
        string authProviderSubject,
        string layoutJson,
        CancellationToken cancellationToken = default);
}
