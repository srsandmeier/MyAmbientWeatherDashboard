using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.Neighbors;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using MediatR;

namespace AmbientWeather.Application.Features.Neighbors.Commands;

/// <summary>
/// Handles <see cref="RefreshNeighborsCommand"/>.
/// </summary>
public sealed class RefreshNeighborsCommandHandler(
    IUserPreferencesStore preferencesStore,
    IUserStationStore stationStore,
    INeighborDiscoveryService discoveryService,
    ILocationGeocodingService geocodingService,
    IAmbientCredentialStore credentialStore,
    ICurrentUserService currentUserService)
    : IRequestHandler<RefreshNeighborsCommand, IReadOnlyList<NeighborStationDto>>
{
    /// <inheritdoc />
    public async Task<IReadOnlyList<NeighborStationDto>> Handle(
        RefreshNeighborsCommand request,
        CancellationToken cancellationToken)
    {
        var subject = currentUserService.RequireAuthenticatedUser();
        var userHash = UserSegmentHash.Compute(subject);

        var prefs = await preferencesStore
            .GetOrCreateAsync(subject, currentUserService.Email, cancellationToken)
            .ConfigureAwait(false);

        var config = NeighborConfigJsonOptions.Deserialize(prefs.NeighborConfigJson) with
        {
            // Refresh is an explicit discovery/search action. It should run even when
            // no owned station has neighbor comparison enabled.
            IsEnabled = true,
        };

        var hasAmbientCredentials = await credentialStore
            .GetAsync(subject, cancellationToken)
            .ConfigureAwait(false) is not null;

        // Populate runtime coordinates from the user's default station only while
        // Ambient credentials are configured; otherwise old cached station rows
        // must not drive nearby discovery.
        var station = await stationStore
            .GetDefaultStationAsync(subject, cancellationToken)
            .ConfigureAwait(false);

        var (latitude, longitude, locationLabel) = await ResolveCoordinatesAsync(
            hasAmbientCredentials ? station : null,
            config.DiscoveryLocationQuery,
            cancellationToken)
            .ConfigureAwait(false);

        if (latitude is null || longitude is null)
            return [];

        var configWithCoords = config with
        {
            UserLatitude = latitude,
            UserLongitude = longitude,
            UserLocationLabel = locationLabel,
            DiscoveryCacheScope = "finder",
            ForceRefresh = true,
        };

        await discoveryService
            .InvalidateCacheAsync(userHash, cancellationToken)
            .ConfigureAwait(false);

        var stations = await discoveryService
            .GetOrDiscoverAsync(userHash, configWithCoords, cancellationToken)
            .ConfigureAwait(false);

        return stations.Select(NeighborStationDto.From).ToList();
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
}
