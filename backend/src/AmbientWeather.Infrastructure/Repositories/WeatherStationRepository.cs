using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.AmbientApi;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using AmbientWeather.Infrastructure.Data;
using AmbientWeather.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace AmbientWeather.Infrastructure.Repositories;

/// <summary>
/// Entity Framework backed store for user-owned <see cref="WeatherStation"/> records.
/// </summary>
public sealed class WeatherStationRepository(AmbientWeatherDbContext dbContext) : IUserStationStore
{
    /// <inheritdoc />
    public async Task<IReadOnlyList<WeatherStation>> GetOwnedStationsAsync(
        string authProviderSubject,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(authProviderSubject);

        var user = await dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.AuthProviderSubject == authProviderSubject, cancellationToken)
            .ConfigureAwait(false);

        if (user == null)
        {
            return [];
        }

        return await dbContext.WeatherStations
            .AsNoTracking()
            .Where(s => s.UserId == user.Id)
            .OrderByDescending(s => s.IsPrimary)
            .ThenBy(s => s.Name)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task<WeatherStation?> GetOwnedStationByMacAsync(
        string authProviderSubject,
        string macAddress,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(authProviderSubject);
        ArgumentException.ThrowIfNullOrWhiteSpace(macAddress);

        var normalized = MacAddressValidator.Normalize(macAddress);

        return await dbContext.WeatherStations
            .Include(s => s.User)
            .FirstOrDefaultAsync(
                s => s.User != null
                     && s.User.AuthProviderSubject == authProviderSubject
                     && s.MacAddress == normalized,
                cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<WeatherStation>> SyncStationsAsync(
        string authProviderSubject,
        string? email,
        IReadOnlyList<DeviceDto> devices,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(authProviderSubject);
        ArgumentNullException.ThrowIfNull(devices);

        var user = await dbContext.Users
            .Include(u => u.WeatherStations)
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

        var hasPrimary = user.WeatherStations.Any(s => s.IsPrimary);
        var syncedAt = DateTime.UtcNow;

        foreach (var (device, index) in devices.Select((d, i) => (d, i)))
        {
            hasPrimary = UpsertStation(user, device, index, hasPrimary, syncedAt);
        }

        await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await SeedDefaultStationIfAbsentAsync(user, cancellationToken).ConfigureAwait(false);

        return await GetOwnedStationsAsync(authProviderSubject, cancellationToken).ConfigureAwait(false);
    }

    /// <summary>
    /// Inserts a new <see cref="WeatherStation"/> or refreshes provider metadata on an existing one.
    /// Returns the updated <paramref name="hasPrimary"/> flag.
    /// </summary>
    private bool UpsertStation(
        AppUser user,
        DeviceDto device,
        int index,
        bool hasPrimary,
        DateTime syncedAt)
    {
        var normalized = MacAddressValidator.Normalize(device.MacAddress);
        var existing = user.WeatherStations
            .FirstOrDefault(s => string.Equals(s.MacAddress, normalized, StringComparison.Ordinal));

        if (existing == null)
        {
            var station = new WeatherStation
            {
                UserId = user.Id,
                MacAddress = normalized,
                Name = device.Info.Name,
                Latitude = device.Info.LocationDetails?.Coords?.Lat,
                Longitude = device.Info.LocationDetails?.Coords?.Lon,
                ElevationMeters = device.Info.LocationDetails?.Elevation,
                Address = device.Info.LocationDetails?.Address,
                Location = device.Info.LocationDetails?.Location,
                Tz = string.IsNullOrWhiteSpace(device.LastData.Tz) ? null : device.LastData.Tz,
                IsPrimary = !hasPrimary && index == 0,
                DisplayOnDashboard = true,
                LastSyncAtUtc = syncedAt,
            };
            dbContext.WeatherStations.Add(station);
            return hasPrimary || station.IsPrimary;
        }

        // Refresh provider metadata; leave user-managed fields untouched.
        existing.Name = device.Info.Name;
        existing.Latitude = device.Info.LocationDetails?.Coords?.Lat;
        existing.Longitude = device.Info.LocationDetails?.Coords?.Lon;
        existing.ElevationMeters = device.Info.LocationDetails?.Elevation;
        existing.Address = device.Info.LocationDetails?.Address;
        existing.Location = device.Info.LocationDetails?.Location;
        if (!string.IsNullOrWhiteSpace(device.LastData.Tz))
            existing.Tz = device.LastData.Tz;
        existing.LastSyncAtUtc = syncedAt;
        return hasPrimary;
    }

    /// <summary>
    /// Sets <see cref="UserPreferences.DefaultWeatherStationId"/> to the primary station the first
    /// time stations are synced, so that Phase 8 metric queries have a default device immediately.
    /// Creates a <see cref="UserPreferences"/> row with defaults when none exists yet (first-time users).
    /// </summary>
    private async Task SeedDefaultStationIfAbsentAsync(AppUser user, CancellationToken cancellationToken)
    {
        var primary = user.WeatherStations.FirstOrDefault(s => s.IsPrimary)
            ?? dbContext.WeatherStations.Local.FirstOrDefault(s => s.UserId == user.Id && s.IsPrimary);

        if (primary == null)
        {
            return;
        }

        var rowsUpdated = await dbContext.UserPreferences
            .Where(p => p.UserId == user.Id && p.DefaultWeatherStationId == null)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(p => p.DefaultWeatherStationId, primary.Id),
                cancellationToken)
            .ConfigureAwait(false);

        if (rowsUpdated > 0)
        {
            return;
        }

        // No row with a null DefaultWeatherStationId — check whether any row exists at all.
        // A new user who has never visited GET /preferences will have no row yet.
        var prefsExist = await dbContext.UserPreferences
            .AnyAsync(p => p.UserId == user.Id, cancellationToken)
            .ConfigureAwait(false);

        if (!prefsExist)
        {
            try
            {
                dbContext.UserPreferences.Add(new UserPreferences
                {
                    UserId = user.Id,
                    DefaultWeatherStationId = primary.Id,
                });
                await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            }
            catch (DbUpdateException)
            {
                // A concurrent SyncStationsAsync for the same new user inserted the row first.
                // Clear the failed tracked entity so the DbContext remains usable.
                dbContext.ChangeTracker.Clear();
            }
        }
        // else: row exists but DefaultWeatherStationId is already set — nothing to do.
    }

    /// <inheritdoc />
    public async Task<WeatherStation?> GetDefaultStationAsync(
        string authProviderSubject,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(authProviderSubject);

        var user = await dbContext.Users
            .AsNoTracking()
            .Include(u => u.WeatherStations)
            .FirstOrDefaultAsync(u => u.AuthProviderSubject == authProviderSubject, cancellationToken)
            .ConfigureAwait(false);

        if (user == null || user.WeatherStations.Count == 0)
            return null;

        var prefs = await dbContext.UserPreferences
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == user.Id, cancellationToken)
            .ConfigureAwait(false);

        var configuredDefault = ResolveConfiguredDefaultAsync(user, prefs);
        if (configuredDefault != null)
            return configuredDefault;

        // Fall back to the primary station and repair the default pointer.
        var primary = await ResolveOrRepairPrimaryAsync(user, cancellationToken).ConfigureAwait(false);
        await RepairDefaultPointerAsync(user.Id, primary.Id, prefs != null, cancellationToken).ConfigureAwait(false);

        return primary;
    }

    private static WeatherStation? ResolveConfiguredDefaultAsync(AppUser user, UserPreferences? prefs)
    {
        if (prefs?.DefaultWeatherStationId == null)
            return null;

        return user.WeatherStations.FirstOrDefault(s => s.Id == prefs.DefaultWeatherStationId);
    }

    private async Task RepairDefaultPointerAsync(
        Guid userId,
        Guid stationId,
        bool preferencesExist,
        CancellationToken cancellationToken)
    {
        try
        {
            if (preferencesExist)
            {
                await dbContext.UserPreferences
                    .Where(p => p.UserId == userId)
                    .ExecuteUpdateAsync(
                        setters => setters.SetProperty(p => p.DefaultWeatherStationId, stationId),
                        cancellationToken)
                    .ConfigureAwait(false);
            }
            else
            {
                dbContext.UserPreferences.Add(new UserPreferences
                {
                    UserId = userId,
                    DefaultWeatherStationId = stationId,
                });
                await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            }
        }
        catch (DbUpdateException)
        {
            dbContext.ChangeTracker.Clear();
        }
    }

    private async Task<WeatherStation> ResolveOrRepairPrimaryAsync(
        AppUser user,
        CancellationToken cancellationToken)
    {
        var primary = user.WeatherStations.FirstOrDefault(s => s.IsPrimary);
        if (primary != null)
        {
            return primary;
        }

        primary = user.WeatherStations.OrderBy(s => s.Name, StringComparer.Ordinal).First();
        await SetSinglePrimaryAsync(user.Id, primary, cancellationToken).ConfigureAwait(false);

        return primary;
    }

    private async Task SetSinglePrimaryAsync(
        Guid userId,
        WeatherStation primary,
        CancellationToken cancellationToken)
    {
        await dbContext.WeatherStations
            .Where(s => s.UserId == userId && s.Id != primary.Id && s.IsPrimary)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(s => s.IsPrimary, false),
                cancellationToken)
            .ConfigureAwait(false);
        await dbContext.WeatherStations
            .Where(s => s.Id == primary.Id)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(s => s.IsPrimary, true),
                cancellationToken)
            .ConfigureAwait(false);
        primary.IsPrimary = true;
    }

    /// <inheritdoc />
    public async Task SaveAsync(WeatherStation station, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(station);

        // Enforce one-primary-per-user at the application layer as a safety net alongside the DB index.
        if (station.IsPrimary && station.UserId.HasValue)
        {
            await dbContext.WeatherStations
                .Where(s => s.UserId == station.UserId && s.Id != station.Id && s.IsPrimary)
                .ExecuteUpdateAsync(
                    setters => setters.SetProperty(s => s.IsPrimary, false),
                    cancellationToken)
                .ConfigureAwait(false);

            // Keep UserPreferences.DefaultWeatherStationId aligned with the primary station.
            var rowsUpdated = await dbContext.UserPreferences
                .Where(p => p.UserId == station.UserId)
                .ExecuteUpdateAsync(
                    setters => setters.SetProperty(p => p.DefaultWeatherStationId, station.Id),
                    cancellationToken)
                .ConfigureAwait(false);

            if (rowsUpdated == 0)
            {
                try
                {
                    dbContext.UserPreferences.Add(new UserPreferences
                    {
                        UserId = station.UserId.Value,
                        DefaultWeatherStationId = station.Id,
                    });
                    await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
                    return; // station changes committed together with the new prefs row — no second save needed
                }
                catch (DbUpdateException)
                {
                    dbContext.ChangeTracker.Clear();
                }
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}
