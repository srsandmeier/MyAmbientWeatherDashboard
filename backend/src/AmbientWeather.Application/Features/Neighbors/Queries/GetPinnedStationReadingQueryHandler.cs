using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.Neighbors;
using AmbientWeather.Application.DTOs.Realtime;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Neighbors;
using MediatR;

namespace AmbientWeather.Application.Features.Neighbors.Queries;

/// <summary>
/// Handles <see cref="GetPinnedStationReadingQuery"/>.
/// Reads the most recently cached observation for a specific pinned station from the
/// <c>neighbor_station_cache</c> table and maps it to a <see cref="CurrentReadingDto"/>.
/// </summary>
public sealed class GetPinnedStationReadingQueryHandler(
    ICurrentUserService currentUserService,
    IUserPreferencesStore preferencesStore,
    IUserStationStore stationStore,
    INeighborDiscoveryService discoveryService)
    : IRequestHandler<GetPinnedStationReadingQuery, CurrentReadingDto>
{
    /// <inheritdoc />
    public async Task<CurrentReadingDto> Handle(
        GetPinnedStationReadingQuery request,
        CancellationToken cancellationToken)
    {
        var subject = currentUserService.RequireAuthenticatedUser();
        var userHash = UserSegmentHash.Compute(subject);

        var prefs = await preferencesStore
            .GetOrCreateAsync(subject, currentUserService.Email, cancellationToken)
            .ConfigureAwait(false);

        var config = NeighborConfigJsonOptions.Deserialize(prefs.NeighborConfigJson);
        if (!config.IsEnabled)
            throw new NeighborsUnavailableException("Neighbor comparison is disabled.");

        var station = await GetCachedOrDiscoveredStationAsync(
                subject,
                userHash,
                config,
                request,
                cancellationToken)
            .ConfigureAwait(false);

        if (station is null)
            throw new AmbientApiNotFoundException(
                $"Station {request.Provider}:{request.SourceId} not found in cache. Refresh neighbor stations first.");

        var label = config.PinnedStations
            .FirstOrDefault(p => string.Equals(p.Provider, request.Provider, StringComparison.Ordinal)
                               && string.Equals(p.SourceId, request.SourceId, StringComparison.Ordinal))
            ?.DisplayLabel;

        return MapToDto(request, station, label);
    }

    private static CurrentReadingDto MapToDto(
        GetPinnedStationReadingQuery request,
        NeighborStation station,
        string? label) => new()
        {
            DeviceId = $"{request.Provider}:{request.SourceId}",
            DeviceName = label ?? station.Name ?? request.SourceId,
            TimestampUtc = station.LastObservedAtUtc ?? DateTime.UtcNow,
            ReceivedAtUtc = DateTime.UtcNow,
            Source = "neighbor",
            TempF = station.TempF,
            Humidity = station.Humidity,
            DewPoint = station.DewPoint,
            FeelsLike = station.FeelsLike,
            BaromRelIn = station.BaromRelIn,
            BaromAbsIn = station.BaromAbsIn,
            WindSpeedMph = station.WindSpeedMph,
            WindGustMph = station.WindGustMph,
            WindDir = station.WindDir,
            HourlyRainIn = station.HourlyRainIn,
            DailyRainIn = station.DailyRainIn,
            WeeklyRainIn = station.WeeklyRainIn,
            MonthlyRainIn = station.MonthlyRainIn,
            YearlyRainIn = station.YearlyRainIn,
            SolarRadiation = station.SolarRadiation,
            Uv = station.Uv,
            DailyHighTempF = station.DailyHighTempF,
            DailyLowTempF = station.DailyLowTempF,
            NwsSkyConditions = station.SkyConditions,
            NwsPresentWeather = station.PresentWeather,
            NwsTextDescription = station.TextDescription,
            NwsRawMetar = station.RawMetar,
            OmCloudCover = station.OmCloudCover,
            OmPrecipProbability = station.OmPrecipProbability,
            OmWeatherDescription = station.OmWeatherDescription,
            OmSunrise = station.OmSunrise,
            OmSunset = station.OmSunset,
            OmUvIndexMax = station.OmUvIndexMax,
            OmPrecipSumIn = station.OmPrecipSumIn,
            OmWindSpeedMax = station.OmWindSpeedMax,
            OmWindGustMax = station.OmWindGustMax,
            OmWindDirDominant = station.OmWindDirDominant,
        };

    private async Task<NeighborStation?> GetCachedOrDiscoveredStationAsync(
        string subject,
        string userHash,
        NeighborConfig config,
        GetPinnedStationReadingQuery request,
        CancellationToken cancellationToken)
    {
        var station = await discoveryService
            .GetCachedStationAsync(userHash, request.Provider, request.SourceId, cancellationToken)
            .ConfigureAwait(false);

        return station ?? await DiscoverPinnedStationAsync(
                subject,
                userHash,
                config,
                request,
                cancellationToken)
            .ConfigureAwait(false);
    }

    private async Task<NeighborStation?> DiscoverPinnedStationAsync(
        string subject,
        string userHash,
        NeighborConfig config,
        GetPinnedStationReadingQuery request,
        CancellationToken cancellationToken)
    {
        var defaultStation = await stationStore
            .GetDefaultStationAsync(subject, cancellationToken)
            .ConfigureAwait(false);

        if (defaultStation?.Latitude is null || defaultStation.Longitude is null)
            return null;

        var configWithCoords = config with
        {
            UserLatitude = defaultStation.Latitude,
            UserLongitude = defaultStation.Longitude,
        };

        var discovered = await discoveryService
            .GetOrDiscoverAsync(userHash, configWithCoords, cancellationToken)
            .ConfigureAwait(false);

        return discovered.FirstOrDefault(s =>
            string.Equals(s.Provider, request.Provider, StringComparison.Ordinal)
            && string.Equals(s.SourceId, request.SourceId, StringComparison.Ordinal));
    }
}
