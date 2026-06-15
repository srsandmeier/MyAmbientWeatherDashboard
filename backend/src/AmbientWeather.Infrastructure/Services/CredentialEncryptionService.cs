using AmbientWeather.Application.Interfaces;
using Microsoft.AspNetCore.DataProtection;

namespace AmbientWeather.Infrastructure.Services;

public class CredentialEncryptionService : ICredentialEncryptionService
{
    private readonly IDataProtector _protector;

    // The purpose string acts as a "key" that prevents this protector
    // from decrypting data protected by other parts of the system.
    private const string ProtectorPurpose = "AmbientWeather.Credentials.V1";

    public CredentialEncryptionService(IDataProtectionProvider dataProtectionProvider)
    {
        _protector = dataProtectionProvider.CreateProtector(ProtectorPurpose);
    }

    public string Encrypt(string plainText)
    {
        return _protector.Protect(plainText);
    }

    public string Decrypt(string encryptedText)
    {
        return _protector.Unprotect(encryptedText);
    }
}
