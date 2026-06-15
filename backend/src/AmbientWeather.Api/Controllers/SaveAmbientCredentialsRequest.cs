namespace AmbientWeather.Api.Controllers;

/// <summary>
/// Request body for saving Ambient Weather credentials.
/// </summary>
/// <param name="ApiKey">The Ambient Weather user API key.</param>
/// <param name="ApplicationKey">The Ambient Weather application key.</param>
public sealed record SaveAmbientCredentialsRequest(
    string ApiKey,
    string ApplicationKey);
