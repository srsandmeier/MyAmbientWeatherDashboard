using System.Text.Json;
using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.Neighbors;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Neighbors;
using MediatR;

namespace AmbientWeather.Application.Features.Neighbors.Commands;

/// <summary>
/// Handles <see cref="UpdateNeighborConfigCommand"/>.
/// </summary>
public sealed class UpdateNeighborConfigCommandHandler(
    IUserPreferencesStore preferencesStore,
    ICurrentUserService currentUserService) : IRequestHandler<UpdateNeighborConfigCommand, NeighborConfigDto>
{
    /// <inheritdoc />
    public async Task<NeighborConfigDto> Handle(
        UpdateNeighborConfigCommand request,
        CancellationToken cancellationToken)
    {
        var subject = currentUserService.RequireAuthenticatedUser();
        var prefs = await preferencesStore
            .GetOrCreateAsync(subject, currentUserService.Email, cancellationToken)
            .ConfigureAwait(false);

        // Read the existing config so we can preserve PinnedStations when not supplied.
        var existing = NeighborConfigJsonOptions.Deserialize(prefs.NeighborConfigJson);

        var config = new NeighborConfig
        {
            IsEnabled = request.IsEnabled,
            EnabledStationMacAddresses = request.EnabledStationMacAddresses?
                .Select(mac => mac.Trim())
                .Where(mac => mac.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList()
                ?? existing.EnabledStationMacAddresses,
            RadiusMiles = request.RadiusMiles,
            ComparisonRadiusMiles = request.ComparisonRadiusMiles ?? existing.ComparisonRadiusMiles,
            MaxAgeMinutes = request.MaxAgeMinutes,
            MinStations = request.MinStations,
            EnabledProviders = request.EnabledProviders,
            RefreshIntervalMinutes = request.RefreshIntervalMinutes,
            DiscoveryLocationQuery = string.IsNullOrWhiteSpace(request.DiscoveryLocationQuery)
                ? null
                : request.DiscoveryLocationQuery.Trim(),
            Municipality = string.IsNullOrWhiteSpace(request.Municipality) ? null : request.Municipality.Trim(),
            PinnedStations = request.PinnedStations ?? existing.PinnedStations,
        };

        prefs.NeighborConfigJson = JsonSerializer.Serialize(
            config, NeighborConfigJsonOptions.Default);
        prefs.UpdatedAtUtc = DateTime.UtcNow;

        await preferencesStore.SaveAsync(prefs, cancellationToken).ConfigureAwait(false);

        return NeighborConfigDto.From(config);
    }
}
