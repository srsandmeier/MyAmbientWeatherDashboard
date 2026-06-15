using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using AmbientWeather.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace AmbientWeather.Infrastructure.Services;

/// <summary>
/// Entity Framework backed store for <see cref="DashboardLayout"/>.
/// Each user has at most one active layout (enforced by a filtered unique index on the table).
/// </summary>
public sealed class DashboardLayoutStore(AmbientWeatherDbContext dbContext) : IDashboardLayoutStore
{
    /// <inheritdoc />
    public async Task<DashboardLayout?> GetActiveAsync(
        string authProviderSubject,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(authProviderSubject);

        return await dbContext.DashboardLayouts
            .AsNoTracking()
            .Where(l => l.User!.AuthProviderSubject == authProviderSubject && l.IsActive)
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task<DashboardLayout> UpsertActiveAsync(
        string authProviderSubject,
        string layoutJson,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(authProviderSubject);
        ArgumentException.ThrowIfNullOrWhiteSpace(layoutJson);

        // Load user with their active layout (tracking on for mutation).
        var user = await dbContext.Users
            .Include(u => u.DashboardLayouts)
            .FirstOrDefaultAsync(u => u.AuthProviderSubject == authProviderSubject, cancellationToken)
            .ConfigureAwait(false);

        if (user is null)
        {
            user = AppUserFactory.Create(authProviderSubject, email: null);
            dbContext.Users.Add(user);
        }

        var existing = user.DashboardLayouts.FirstOrDefault(l => l.IsActive);

        if (existing is not null)
        {
            existing.LayoutJson = layoutJson;
            existing.UpdatedAtUtc = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return existing;
        }

        var layout = new DashboardLayout
        {
            UserId = user.Id,
            Name = "Default",
            IsActive = true,
            LayoutJson = layoutJson,
            UpdatedAtUtc = DateTime.UtcNow,
        };
        dbContext.DashboardLayouts.Add(layout);
        await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return layout;
    }
}
