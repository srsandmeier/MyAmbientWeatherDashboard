using MediatR;

namespace AmbientWeather.Application.Features.PublicSources.Commands;

/// <summary>
/// Deletes a public weather source selected by the authenticated user.
/// </summary>
public sealed record DeletePublicWeatherSourceCommand(Guid Id) : IRequest;
