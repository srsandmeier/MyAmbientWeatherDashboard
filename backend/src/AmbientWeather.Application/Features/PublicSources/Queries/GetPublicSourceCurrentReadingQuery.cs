using AmbientWeather.Application.DTOs.Realtime;
using MediatR;

namespace AmbientWeather.Application.Features.PublicSources.Queries;

/// <summary>
/// Query for a current reading from a selected public weather source.
/// </summary>
public sealed record GetPublicSourceCurrentReadingQuery(Guid Id) : IRequest<CurrentReadingDto>;
