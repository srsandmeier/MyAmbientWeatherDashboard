using MediatR;

namespace AmbientWeather.Application.Features.Settings.Commands;

/// <summary>
/// Saves Ambient Weather credentials for the authenticated user after validating them with Ambient.
/// </summary>
/// <param name="ApiKey">The Ambient Weather user API key.</param>
/// <param name="ApplicationKey">The Ambient Weather application key.</param>
public sealed record SaveAmbientCredentialsCommand(
    string ApiKey,
    string ApplicationKey) : IRequest;
