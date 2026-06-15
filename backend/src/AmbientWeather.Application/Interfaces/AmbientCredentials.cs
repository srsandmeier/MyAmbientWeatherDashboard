namespace AmbientWeather.Application.Interfaces;

/// <summary>
/// Decrypted Ambient Weather credentials for backend-only use.
/// </summary>
/// <param name="ApiKey">The Ambient Weather user API key.</param>
/// <param name="ApplicationKey">The Ambient Weather application key.</param>
public sealed record AmbientCredentials(string ApiKey, string ApplicationKey);
