using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.Alerts;
using AmbientWeather.Application.Interfaces;
using MediatR;

namespace AmbientWeather.Application.Features.Alerts.Queries;

/// <summary>
/// Handles <see cref="GetActiveAlertsQuery"/>.
/// </summary>
public sealed class GetActiveAlertsQueryHandler(
    ICurrentUserService currentUserService,
    IUserStationStore stationStore,
    IWeatherAlertService alertService) : IRequestHandler<GetActiveAlertsQuery, IReadOnlyList<WeatherAlertDto>>
{
    /// <inheritdoc />
    public async Task<IReadOnlyList<WeatherAlertDto>> Handle(
        GetActiveAlertsQuery request,
        CancellationToken cancellationToken)
    {
        var subject = currentUserService.RequireAuthenticatedUser();
        var userHash = UserSegmentHash.Compute(subject);

        if (!string.IsNullOrWhiteSpace(request.AreaCode))
        {
            return await alertService
                .GetActiveAlertsForAreaAsync(userHash, request.AreaCode, cancellationToken)
                .ConfigureAwait(false);
        }

        var station = await stationStore.GetDefaultStationAsync(subject, cancellationToken).ConfigureAwait(false);

        if (station?.Latitude is null || station.Longitude is null)
            return [];

        return await alertService
            .GetActiveAlertsAsync(userHash, station.Latitude.Value, station.Longitude.Value, cancellationToken)
            .ConfigureAwait(false);
    }
}
