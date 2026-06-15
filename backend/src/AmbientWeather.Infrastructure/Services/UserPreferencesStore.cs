using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using AmbientWeather.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace AmbientWeather.Infrastructure.Services;

/// <summary>
/// Entity Framework backed store for <see cref="UserPreferences"/>.
/// Creates a row with default values on first access so callers always receive a non-null result.
/// </summary>
public sealed class UserPreferencesStore(AmbientWeatherDbContext dbContext) : IUserPreferencesStore
{
    /// <inheritdoc />
    public async Task<UserPreferences> GetOrCreateAsync(
        string authProviderSubject,
        string? email,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(authProviderSubject);

        var user = await dbContext.Users
            .Include(u => u.Preferences)
            .FirstOrDefaultAsync(u => u.AuthProviderSubject == authProviderSubject, cancellationToken)
            .ConfigureAwait(false);

        if (user == null)
        {
            user = AppUserFactory.Create(authProviderSubject, email);
            dbContext.Users.Add(user);
        }
        else
        {
            user.Email = email ?? user.Email;
        }

        if (user.Preferences != null)
        {
            return user.Preferences;
        }

        var prefs = new UserPreferences
        {
            UserId = user.Id,
            UpdatedAtUtc = DateTime.UtcNow,
        };
        dbContext.UserPreferences.Add(prefs);
        user.Preferences = prefs;
        await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        return prefs;
    }

    /// <inheritdoc />
    public async Task SaveAsync(UserPreferences preferences, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(preferences);
        await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}
