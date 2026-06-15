using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.AmbientApi;
using AmbientWeather.Application.DTOs.Dashboard;
using AmbientWeather.Application.DTOs.Realtime;
using AmbientWeather.Application.Features.Realtime;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using MediatR;

namespace AmbientWeather.Application.Features.Dashboard.Queries;

/// <summary>
/// Handler for <see cref="GetDashboardRainfallQuery"/>.
/// Resolves the user's default station, reads from the latest-reading cache, and
/// falls back to the Ambient REST API on cache miss. Extracts rainfall fields from
/// the <see cref="CurrentReadingDto"/> and returns a <see cref="DashboardRainfallDto"/>.
/// </summary>
internal sealed class GetDashboardRainfallQueryHandler
    : IRequestHandler<GetDashboardRainfallQuery, DashboardRainfallDto>
{
    private readonly ICurrentUserService _currentUserService;
    private readonly IAmbientCredentialStore _credentialStore;
    private readonly IUserStationStore _stationStore;
    private readonly ILatestReadingCache _cache;
    private readonly IAmbientRestClient _restClient;

    /// <summary>Initializes the handler.</summary>
    public GetDashboardRainfallQueryHandler(
        ICurrentUserService currentUserService,
        IAmbientCredentialStore credentialStore,
        IUserStationStore stationStore,
        ILatestReadingCache cache,
        IAmbientRestClient restClient)
    {
        _currentUserService = currentUserService;
        _credentialStore = credentialStore;
        _stationStore = stationStore;
        _cache = cache;
        _restClient = restClient;
    }

    /// <inheritdoc />
    public async Task<DashboardRainfallDto> Handle(
        GetDashboardRainfallQuery request,
        CancellationToken cancellationToken)
    {
        var subject = _currentUserService.RequireAuthenticatedUser();

        var credentials = await _credentialStore.GetAsync(subject, cancellationToken)
            .ConfigureAwait(false);
        if (credentials is null)
            throw new AmbientCredentialsRequiredException();

        var station = await _stationStore.GetDefaultStationAsync(subject, cancellationToken)
            .ConfigureAwait(false);
        if (station is null)
            throw new AmbientStationsRequiredException();

        var userHash = UserSegmentHash.Compute(subject);

        // Attempt cache hit first.
        var cached = await _cache.GetAsync(userHash, station.MacAddress, cancellationToken)
            .ConfigureAwait(false);
        if (cached is not null && CurrentReadingCompleteness.HasAnySensorValue(cached))
            return ToRainfallDto(cached);

        // Cache miss — fall back to REST API.
        var devices = await _restClient
            .GetDevicesAsync(credentials.ApiKey, credentials.ApplicationKey, cancellationToken)
            .ConfigureAwait(false);

        var device = devices.FirstOrDefault(d =>
            MacAddressValidator.EqualsNormalized(d.MacAddress, station.MacAddress));

        if (device is null)
        {
            return ToRainfallDto(await DashboardReadingFallbackHelper.GetLatestHistoryReadingOrShellAsync(
                    _restClient,
                    _cache,
                    credentials,
                    station,
                    station.MacAddress,
                    userHash,
                    cancellationToken)
                .ConfigureAwait(false));
        }

        var reading = CurrentReadingMapper.FromDeviceData(device.LastData, station);
        if (!CurrentReadingCompleteness.HasAnySensorValue(reading))
        {
            return ToRainfallDto(await DashboardReadingFallbackHelper.GetLatestHistoryReadingOrShellAsync(
                    _restClient,
                    _cache,
                    credentials,
                    station,
                    device.MacAddress,
                    userHash,
                    cancellationToken)
                .ConfigureAwait(false));
        }

        await _cache.SetAsync(userHash, station.MacAddress, reading, cancellationToken)
            .ConfigureAwait(false);

        return ToRainfallDto(reading);
    }

    private static DashboardRainfallDto ToRainfallDto(CurrentReadingDto r) => new()
    {
        DeviceId = r.DeviceId,
        DeviceName = r.DeviceName,
        TimestampUtc = r.TimestampUtc == default ? null : r.TimestampUtc,
        ReceivedAtUtc = r.ReceivedAtUtc,
        EventRainIn = r.EventRainIn,
        DailyRainIn = r.DailyRainIn,
        WeeklyRainIn = r.WeeklyRainIn,
        MonthlyRainIn = r.MonthlyRainIn,
        YearlyRainIn = r.YearlyRainIn,
        LastRain = r.LastRain,
    };

}
