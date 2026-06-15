using AmbientWeather.Domain.Entities;

namespace AmbientWeather.Infrastructure.Services;

/// <summary>
/// Creates <see cref="AppUser"/> instances with consistent defaults.
/// Centralises construction so adding or changing a required field only needs one update.
/// </summary>
internal static class AppUserFactory
{
    internal static AppUser Create(string authProviderSubject, string? email) => new()
    {
        Id = Guid.NewGuid(),
        AuthProviderSubject = authProviderSubject,
        Email = email,
        CreatedAtUtc = DateTime.UtcNow,
    };
}
