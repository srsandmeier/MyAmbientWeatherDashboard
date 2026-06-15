using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using AmbientWeather.Infrastructure.Data;
using AmbientWeather.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace AmbientWeather.Infrastructure.Repositories;

/// <summary>
/// Entity Framework backed store for user-selected <see cref="PublicWeatherSource"/> records.
/// </summary>
public sealed class PublicWeatherSourceRepository(AmbientWeatherDbContext dbContext) : IPublicWeatherSourceStore
{
    /// <inheritdoc />
    public async Task<IReadOnlyList<PublicWeatherSource>> GetAllAsync(
        string authProviderSubject,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(authProviderSubject);

        return await dbContext.PublicWeatherSources
            .AsNoTracking()
            .Where(s => s.User!.AuthProviderSubject == authProviderSubject)
            .OrderByDescending(s => s.IsEnabled)
            .ThenBy(s => s.DisplayLabel)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task<PublicWeatherSource?> GetByIdAsync(
        string authProviderSubject,
        Guid sourceId,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(authProviderSubject);

        return await dbContext.PublicWeatherSources
            .Include(s => s.User)
            .FirstOrDefaultAsync(
                s => s.Id == sourceId
                     && s.User != null
                     && s.User.AuthProviderSubject == authProviderSubject,
                cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task<PublicWeatherSource> AddAsync(
        string authProviderSubject,
        string? email,
        PublicWeatherSource source,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(authProviderSubject);
        ArgumentNullException.ThrowIfNull(source);

        var user = await dbContext.Users
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

        source.UserId = user.Id;
        dbContext.PublicWeatherSources.Add(source);
        await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return source;
    }

    /// <inheritdoc />
    public async Task SaveAsync(PublicWeatherSource source, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(source);
        await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task DeleteAsync(PublicWeatherSource source, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(source);
        dbContext.PublicWeatherSources.Remove(source);
        await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}
