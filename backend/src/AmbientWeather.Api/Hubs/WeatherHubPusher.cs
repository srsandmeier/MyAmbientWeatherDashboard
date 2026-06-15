using AmbientWeather.Application.DTOs.Realtime;
using AmbientWeather.Application.Interfaces;
using Microsoft.AspNetCore.SignalR;

namespace AmbientWeather.Api.Hubs;

/// <summary>
/// Adapts <see cref="IHubContext{WeatherHub}"/> to the <see cref="IWeatherHubPusher"/>
/// interface so the Infrastructure layer can deliver messages to SignalR clients without
/// depending on the hub type directly.
/// </summary>
internal sealed class WeatherHubPusher(IHubContext<WeatherHub> hubContext) : IWeatherHubPusher
{
    /// <inheritdoc />
    public Task SendReadingUpdatedAsync(
        string userHash,
        ReadingUpdatedEventDto dto,
        CancellationToken cancellationToken = default) =>
        hubContext.Clients
            .Group(WeatherHub.GroupName(userHash))
            .SendAsync("ReadingUpdated", dto, cancellationToken);
}
