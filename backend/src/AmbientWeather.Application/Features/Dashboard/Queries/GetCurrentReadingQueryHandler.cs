using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.AmbientApi;
using AmbientWeather.Application.DTOs.Realtime;
using AmbientWeather.Application.Features.Realtime;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using MediatR;

namespace AmbientWeather.Application.Features.Dashboard.Queries;

/// <summary>
/// Handler for <see cref="GetCurrentReadingQuery"/>.
/// Resolves the authenticated user's default station, then attempts to return the latest
/// cached reading. If the cache is empty (first load) or stale, falls back to fetching
/// current data from the Ambient Weather REST API.
/// </summary>
internal sealed class GetCurrentReadingQueryHandler : IRequestHandler<GetCurrentReadingQuery, CurrentReadingDto>
{
    private readonly ICurrentUserService _currentUserService;
    private readonly IAmbientCredentialStore _credentialStore;
    private readonly IUserStationStore _stationStore;
    private readonly ILatestReadingCache _cache;
    private readonly IAmbientRestClient _restClient;

    /// <summary>Initializes the handler.</summary>
    public GetCurrentReadingQueryHandler(
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
    public async Task<CurrentReadingDto> Handle(
        GetCurrentReadingQuery request,
        CancellationToken cancellationToken)
    {
        var (credentials, station, userHash) = await GetRequiredContextAsync(cancellationToken)
            .ConfigureAwait(false);

        // Attempt cache hit first. ReceivedAtUtc lets the UI decide staleness threshold.
        var cached = await _cache.GetAsync(userHash, station.MacAddress, cancellationToken)
            .ConfigureAwait(false);
        if (cached is not null && CurrentReadingCompleteness.HasAnySensorValue(cached))
            return cached;

        // Cache miss or stale; fetch from Ambient REST API.
        // This call is subject to the rate limiter and circuit breaker on the REST client.
        var devices = await _restClient
            .GetDevicesAsync(credentials.ApiKey, credentials.ApplicationKey, cancellationToken)
            .ConfigureAwait(false);

        var device = devices.FirstOrDefault(d =>
            MacAddressValidator.EqualsNormalized(d.MacAddress, station.MacAddress));

        if (device is null)
        {
            return await DashboardReadingFallbackHelper.GetLatestHistoryReadingOrShellAsync(
                    _restClient,
                    _cache,
                    credentials,
                    station,
                    station.MacAddress,
                    userHash,
                    cancellationToken)
                .ConfigureAwait(false);
        }

        var reading = CurrentReadingMapper.FromDeviceData(device.LastData, station);
        if (!CurrentReadingCompleteness.HasAnySensorValue(reading))
        {
            return await DashboardReadingFallbackHelper.GetLatestHistoryReadingOrShellAsync(
                    _restClient,
                    _cache,
                    credentials,
                    station,
                    device.MacAddress,
                    userHash,
                    cancellationToken)
                .ConfigureAwait(false);
        }

        // Cache the result for 5 minutes so rapid polls don't spam the API.
        await _cache.SetAsync(userHash, station.MacAddress, reading, cancellationToken)
            .ConfigureAwait(false);

        return reading;
    }

    private async Task<(AmbientCredentials Credentials, WeatherStation Station, string UserHash)> GetRequiredContextAsync(
        CancellationToken cancellationToken)
    {
        var subject = _currentUserService.RequireAuthenticatedUser();

        // Resolve credentials — must exist to fetch either from cache or REST.
        var credentials = await _credentialStore.GetAsync(subject, cancellationToken)
            .ConfigureAwait(false);
        if (credentials is null)
            throw new AmbientCredentialsRequiredException();

        // Resolve the user's default station — must exist to determine what to fetch.
        var station = await _stationStore.GetDefaultStationAsync(subject, cancellationToken)
            .ConfigureAwait(false);
        if (station is null)
            throw new AmbientStationsRequiredException();

        return (credentials, station, UserSegmentHash.Compute(subject));
    }
}
