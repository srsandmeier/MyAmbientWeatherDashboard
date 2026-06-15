using AmbientWeather.Application.DTOs.Settings;
using MediatR;

namespace AmbientWeather.Application.Features.Settings.Queries;

/// <summary>
/// Gets safe Ambient Weather credential status for the authenticated user.
/// </summary>
public sealed record GetAmbientCredentialStatusQuery : IRequest<AmbientCredentialStatusDto>;
