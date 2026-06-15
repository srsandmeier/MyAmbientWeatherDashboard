namespace AmbientWeather.Application.Interfaces;

public interface ICredentialEncryptionService
{
    string Encrypt(string plainText);
    string Decrypt(string encryptedText);
}
