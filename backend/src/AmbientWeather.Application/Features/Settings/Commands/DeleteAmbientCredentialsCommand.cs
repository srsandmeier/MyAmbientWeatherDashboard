using MediatR;

namespace AmbientWeather.Application.Features.Settings.Commands;

/// <summary>
/// Deletes Ambient Weather credentials for the authenticated user.
/// </summary>
public sealed record DeleteAmbientCredentialsCommand : IRequest;
