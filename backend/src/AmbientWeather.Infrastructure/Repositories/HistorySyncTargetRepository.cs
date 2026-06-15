using System.Security.Cryptography;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AmbientWeather.Infrastructure.Repositories;

/// <summary>
/// Entity Framework implementation for history sync target discovery.
/// </summary>
public sealed partial class HistorySyncTargetRepository(
    AmbientWeatherDbContext dbContext,
    ICredentialEncryptionService credentialEncryptionService,
    ILogger<HistorySyncTargetRepository> logger) : IHistorySyncTargetRepository
{
    /// <inheritdoc />
    public async Task<IReadOnlyList<HistorySyncTarget>> GetEnabledTargetsAsync(
        CancellationToken cancellationToken = default)
    {
        var users = await dbContext.Users
            .AsNoTracking()
            .Include(e => e.AmbientCredentials)
            .Include(e => e.WeatherStations.Where(station => station.DisplayOnDashboard))
            .Where(e => e.AmbientCredentials != null)
            .ToListAsync(cancellationToken).ConfigureAwait(false);

        var targets = new List<HistorySyncTarget>();

        foreach (var user in users)
        {
            if (user.AmbientCredentials == null)
            {
                continue;
            }

            AmbientCredentials credentials;
            try
            {
                credentials = new AmbientCredentials(
                    credentialEncryptionService.Decrypt(user.AmbientCredentials.ApiKeyEncrypted),
                    credentialEncryptionService.Decrypt(user.AmbientCredentials.ApplicationKeyEncrypted));
            }
            catch (CryptographicException ex)
            {
                LogCredentialsDecryptionFailed(logger, ex, user.Id);
                continue;
            }

            foreach (var station in user.WeatherStations)
            {
                targets.Add(new HistorySyncTarget(
                    user.Id,
                    station.Id,
                    station.MacAddress,
                    credentials.ApiKey,
                    credentials.ApplicationKey));
            }
        }

        return targets;
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Skipping history sync for user {UserId} because stored Ambient credentials cannot be decrypted.")]
    private static partial void LogCredentialsDecryptionFailed(ILogger logger, Exception exception, Guid userId);
}
