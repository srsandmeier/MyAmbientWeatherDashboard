using System.Net;
using AmbientWeather.Application.DTOs.AmbientApi;
using AmbientWeather.Application.DTOs.Realtime;
using AmbientWeather.Application.Features.Realtime;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;

namespace AmbientWeather.Application.Features.Dashboard;

/// <summary>Shared fallback logic for retrieving the latest reading or a shell.</summary>
internal static class DashboardReadingFallbackHelper
{
    /// <summary>Gets the most recent history reading or a shell DTO if unavailable.</summary>
    internal static async Task<CurrentReadingDto> GetLatestHistoryReadingOrShellAsync(
        IAmbientRestClient restClient,
        ILatestReadingCache cache,
        AmbientCredentials credentials,
        WeatherStation station,
        string providerMacAddress,
        string userHash,
        CancellationToken cancellationToken)
    {
        DeviceHistoryResponseDto? history;
        try
        {
            history = await restClient
                .GetDeviceHistoryAsync(
                    providerMacAddress,
                    credentials.ApiKey,
                    credentials.ApplicationKey,
                    limit: 1,
                    endDate: null,
                    cancellationToken)
                .ConfigureAwait(false);
        }
        catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return CreateShell(station);
        }

        var latest = (history?.Readings ?? [])
            .OrderByDescending(r => r.DateUtc)
            .FirstOrDefault();

        if (latest is null)
        {
            return CreateShell(station);
        }

        var reading = CurrentReadingMapper.FromWeatherReading(latest, station);

        await cache.SetAsync(userHash, station.MacAddress, reading, cancellationToken)
            .ConfigureAwait(false);

        return reading;
    }

    /// <summary>Creates a shell <see cref="CurrentReadingDto"/> with no sensor values.</summary>
    internal static CurrentReadingDto CreateShell(WeatherStation station) => new()
    {
        DeviceId = station.MacAddress,
        DeviceName = station.Nickname ?? station.Name,
        TimestampUtc = DateTime.UtcNow,
        ReceivedAtUtc = DateTime.UtcNow,
    };
}
