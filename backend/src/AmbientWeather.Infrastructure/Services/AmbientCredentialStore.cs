using System.Security.Cryptography;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using AmbientWeather.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AmbientWeather.Infrastructure.Services;

/// <summary>
/// Entity Framework backed credential store using Data Protection encrypted values.
/// </summary>
public sealed partial class AmbientCredentialStore(
    AmbientWeatherDbContext dbContext,
    ICredentialEncryptionService credentialEncryptionService,
    ILogger<AmbientCredentialStore> logger) : IAmbientCredentialStore
{
    /// <inheritdoc />
    public async Task SaveAsync(
        string authProviderSubject,
        string? email,
        string apiKey,
        string applicationKey,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(authProviderSubject);
        ArgumentException.ThrowIfNullOrWhiteSpace(apiKey);
        ArgumentException.ThrowIfNullOrWhiteSpace(applicationKey);

        var user = await GetOrCreateUserAsync(authProviderSubject, email, cancellationToken).ConfigureAwait(false);
        var updatedAtUtc = DateTime.UtcNow;

        if (user.AmbientCredentials == null)
        {
            user.AmbientCredentials = new UserAmbientCredentials
            {
                UserId = user.Id,
                ApiKeyEncrypted = credentialEncryptionService.Encrypt(apiKey),
                ApplicationKeyEncrypted = credentialEncryptionService.Encrypt(applicationKey),
                UpdatedAtUtc = updatedAtUtc
            };
        }
        else
        {
            user.AmbientCredentials.ApiKeyEncrypted = credentialEncryptionService.Encrypt(apiKey);
            user.AmbientCredentials.ApplicationKeyEncrypted = credentialEncryptionService.Encrypt(applicationKey);
            user.AmbientCredentials.UpdatedAtUtc = updatedAtUtc;
        }

        await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        LogCredentialsSaved(logger);
    }

    /// <inheritdoc />
    public async Task<AmbientCredentials?> GetAsync(
        string authProviderSubject,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(authProviderSubject);

        var user = await dbContext.Users
            .Include(e => e.AmbientCredentials)
            .FirstOrDefaultAsync(e => e.AuthProviderSubject == authProviderSubject, cancellationToken).ConfigureAwait(false);

        if (user?.AmbientCredentials == null)
        {
            return null;
        }

        try
        {
            return new AmbientCredentials(
                credentialEncryptionService.Decrypt(user.AmbientCredentials.ApiKeyEncrypted),
                credentialEncryptionService.Decrypt(user.AmbientCredentials.ApplicationKeyEncrypted));
        }
        catch (CryptographicException ex)
        {
            LogCredentialsDecryptionFailed(logger, ex);

            dbContext.UserAmbientCredentials.Remove(user.AmbientCredentials);
            await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return null;
        }
    }

    /// <inheritdoc />
    public async Task DeleteAsync(
        string authProviderSubject,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(authProviderSubject);

        var credentials = await dbContext.UserAmbientCredentials
            .Include(e => e.User)
            .FirstOrDefaultAsync(e => e.User != null && e.User.AuthProviderSubject == authProviderSubject, cancellationToken).ConfigureAwait(false);

        if (credentials == null)
        {
            return;
        }

        dbContext.UserAmbientCredentials.Remove(credentials);
        await dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        LogCredentialsDeleted(logger);
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Ambient credentials saved for authenticated user.")]
    private static partial void LogCredentialsSaved(ILogger logger);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Stored Ambient credentials could not be decrypted for authenticated user.")]
    private static partial void LogCredentialsDecryptionFailed(ILogger logger, Exception exception);

    [LoggerMessage(Level = LogLevel.Information, Message = "Ambient credentials deleted for authenticated user.")]
    private static partial void LogCredentialsDeleted(ILogger logger);

    private async Task<AppUser> GetOrCreateUserAsync(
        string authProviderSubject,
        string? email,
        CancellationToken cancellationToken)
    {
        var user = await dbContext.Users
            .Include(e => e.AmbientCredentials)
            .FirstOrDefaultAsync(e => e.AuthProviderSubject == authProviderSubject, cancellationToken).ConfigureAwait(false);

        if (user != null)
        {
            user.Email = email ?? user.Email;
            return user;
        }

        user = AppUserFactory.Create(authProviderSubject, email);
        dbContext.Users.Add(user);
        return user;
    }
}
