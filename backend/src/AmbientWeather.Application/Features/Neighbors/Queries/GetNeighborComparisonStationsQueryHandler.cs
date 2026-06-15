using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.Neighbors;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using AmbientWeather.Domain.Neighbors;
using MediatR;

namespace AmbientWeather.Application.Features.Neighbors.Queries;

/// <summary>
/// Handles <see cref="GetNeighborComparisonStationsQuery"/>.
/// </summary>
public sealed class GetNeighborComparisonStationsQueryHandler(
    ICurrentUserService currentUserService,
    IUserPreferencesStore preferencesStore,
    IUserStationStore stationStore,
    INeighborDiscoveryService discoveryService)
    : IRequestHandler<GetNeighborComparisonStationsQuery, IReadOnlyList<NeighborStationDto>>
{
    /// <inheritdoc />
    public async Task<IReadOnlyList<NeighborStationDto>> Handle(
        GetNeighborComparisonStationsQuery request,
        CancellationToken cancellationToken)
    {
        var subject = currentUserService.RequireAuthenticatedUser();
        var userHash = UserSegmentHash.Compute(subject);

        var prefs = await preferencesStore
            .GetOrCreateAsync(subject, currentUserService.Email, cancellationToken)
            .ConfigureAwait(false);

        var config = NeighborConfigJsonOptions.Deserialize(prefs.NeighborConfigJson);

        var station = await ResolveStationAsync(subject, request.MacAddress, cancellationToken)
            .ConfigureAwait(false);

        if (!IsEnabledForStation(config, station))
            return [];

        if (station?.Latitude is null || station.Longitude is null)
            return [];

        var comparisonConfig = config with
        {
            UserLatitude = station.Latitude,
            UserLongitude = station.Longitude,
            UserLocationLabel = NeighborLocationHelper.GetStationLocationLabel(station),
            RadiusMiles = config.ComparisonRadiusMiles,
            EnabledProviders = ["AmbientOpen"],
            DiscoveryCacheScope = $"comparison:{station.MacAddress}",
            ForceRefresh = true,
        };

        var stations = await discoveryService
            .GetOrDiscoverAsync(userHash, comparisonConfig, cancellationToken)
            .ConfigureAwait(false);

        return stations.Take(50).Select(NeighborStationDto.From).ToList();
    }

    private async Task<WeatherStation?> ResolveStationAsync(
        string subject,
        string? macAddress,
        CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(macAddress))
        {
            return await stationStore
                .GetOwnedStationByMacAsync(subject, macAddress, cancellationToken)
                .ConfigureAwait(false);
        }

        return await stationStore
            .GetDefaultStationAsync(subject, cancellationToken)
            .ConfigureAwait(false);
    }

    private static bool IsEnabledForStation(NeighborConfig config, WeatherStation? station)
    {
        if (config.EnabledStationMacAddresses.Count == 0)
            return config.IsEnabled;

        return station?.MacAddress is { Length: > 0 } mac
            && config.EnabledStationMacAddresses.Contains(mac, StringComparer.OrdinalIgnoreCase);
    }

}
