using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.Neighbors;
using AmbientWeather.Application.DTOs.Realtime;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using AmbientWeather.Domain.Neighbors;
using MediatR;

namespace AmbientWeather.Application.Features.Neighbors.Queries;

/// <summary>
/// Handles <see cref="GetNeighborCurrentReadingQuery"/>.
/// </summary>
public sealed class GetNeighborCurrentReadingQueryHandler(
    ICurrentUserService currentUserService,
    IUserPreferencesStore preferencesStore,
    IUserStationStore stationStore,
    INeighborDiscoveryService discoveryService,
    INeighborAggregationService aggregationService,
    ILocationGeocodingService geocodingService,
    IAmbientCredentialStore credentialStore)
    : IRequestHandler<GetNeighborCurrentReadingQuery, CurrentReadingDto>
{
    /// <inheritdoc />
    public async Task<CurrentReadingDto> Handle(
        GetNeighborCurrentReadingQuery request,
        CancellationToken cancellationToken)
    {
        var subject = currentUserService.RequireAuthenticatedUser();
        var userHash = UserSegmentHash.Compute(subject);

        var prefs = await preferencesStore
            .GetOrCreateAsync(subject, currentUserService.Email, cancellationToken)
            .ConfigureAwait(false);

        var hasAmbientCredentials = await credentialStore
            .GetAsync(subject, cancellationToken)
            .ConfigureAwait(false) is not null;

        var station = await stationStore
            .GetDefaultStationAsync(subject, cancellationToken)
            .ConfigureAwait(false);

        var config = NeighborConfigJsonOptions.Deserialize(prefs.NeighborConfigJson);

        if (!IsEnabledForStation(config, station))
            throw new NeighborsUnavailableException("Neighbor comparison is disabled. Enable it for this station in Settings.");

        var (latitude, longitude, locationLabel) = await ResolveCoordinatesAsync(
            hasAmbientCredentials ? station : null,
            config.DiscoveryLocationQuery,
            cancellationToken)
            .ConfigureAwait(false);

        if (latitude is null || longitude is null)
            throw new NeighborsUnavailableException("No station coordinates or public-source discovery location are available for neighbor discovery.");

        var configWithCoords = config with
        {
            UserLatitude = latitude,
            UserLongitude = longitude,
            UserLocationLabel = locationLabel,
            RadiusMiles = config.ComparisonRadiusMiles,
            EnabledProviders = ["AmbientOpen"],
            DiscoveryCacheScope = station?.MacAddress is { Length: > 0 } mac
                ? $"comparison:{mac}"
                : "comparison",
        };

        var stations = await discoveryService
            .GetOrDiscoverAsync(userHash, configWithCoords, cancellationToken)
            .ConfigureAwait(false);

        var aggregated = aggregationService.Aggregate(stations, config.MinStations);
        return MapToCurrentReading(aggregated, stations.Count);
    }

    private async Task<(double? Latitude, double? Longitude, string? LocationLabel)> ResolveCoordinatesAsync(
        WeatherStation? station,
        string? discoveryLocationQuery,
        CancellationToken cancellationToken)
    {
        if (station?.Latitude is not null && station.Longitude is not null)
            return (station.Latitude, station.Longitude, NeighborLocationHelper.GetStationLocationLabel(station));

        if (string.IsNullOrWhiteSpace(discoveryLocationQuery))
            return (null, null, null);

        var location = await geocodingService
            .GeocodeAsync(discoveryLocationQuery, cancellationToken)
            .ConfigureAwait(false);

        return location is null
            ? (null, null, null)
            : (location.Latitude, location.Longitude, NeighborLocationHelper.NormalizeLocationLabel(location.DisplayName) ?? discoveryLocationQuery.Trim());
    }

    private static bool IsEnabledForStation(NeighborConfig config, WeatherStation? station)
    {
        if (config.EnabledStationMacAddresses.Count == 0)
            return config.IsEnabled;

        return station?.MacAddress is { Length: > 0 } mac
            && config.EnabledStationMacAddresses.Contains(mac, StringComparer.OrdinalIgnoreCase);
    }

    private static CurrentReadingDto MapToCurrentReading(
        AggregatedNeighborReadingDto agg,
        int stationCount) => new()
        {
            DeviceId = "neighbors",
            DeviceName = $"{stationCount} nearby station{(stationCount == 1 ? "" : "s")}",
            TimestampUtc = DateTime.UtcNow,
            ReceivedAtUtc = DateTime.UtcNow,
            Source = "neighbors",
            TempF = agg.TempF,
            Humidity = agg.Humidity,
            DewPoint = agg.DewPoint,
            FeelsLike = agg.FeelsLike,
            BaromRelIn = agg.BaromRelIn,
            BaromAbsIn = agg.BaromAbsIn,
            WindSpeedMph = agg.WindSpeedMph,
            WindGustMph = agg.WindGustMph,
            WindDir = agg.WindDir,
            HourlyRainIn = agg.HourlyRainIn,
            DailyRainIn = agg.DailyRainIn,
            WeeklyRainIn = agg.WeeklyRainIn,
            MonthlyRainIn = agg.MonthlyRainIn,
            YearlyRainIn = agg.YearlyRainIn,
            SolarRadiation = agg.SolarRadiation,
            Uv = agg.Uv,
            DailyHighTempF = agg.DailyHighTempF,
            DailyLowTempF = agg.DailyLowTempF,
        };
}
