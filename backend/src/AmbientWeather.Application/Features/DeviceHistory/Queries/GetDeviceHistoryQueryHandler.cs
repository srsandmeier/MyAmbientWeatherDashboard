using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.AmbientApi;
using AmbientWeather.Application.Interfaces;
using MediatR;

namespace AmbientWeather.Application.Features.DeviceHistory.Queries;

/// <summary>
/// Handles <see cref="GetDeviceHistoryQuery"/> by verifying ownership and retrieving history
/// through the current user's stored credentials.
/// </summary>
public sealed class GetDeviceHistoryQueryHandler(
    IDeviceHistoryService deviceHistoryService,
    ICurrentUserService currentUserService,
    IUserStationStore stationStore)
    : IRequestHandler<GetDeviceHistoryQuery, DeviceHistoryResponseDto>
{
    /// <inheritdoc />
    public async Task<DeviceHistoryResponseDto> Handle(
        GetDeviceHistoryQuery request,
        CancellationToken cancellationToken)
    {
        var subject = currentUserService.RequireAuthenticatedUser();
        var station = await stationStore.GetOwnedStationByMacAsync(subject, request.MacAddress, cancellationToken).ConfigureAwait(false);
        if (station is null)
            throw new AmbientApiNotFoundException();

        return await deviceHistoryService.GetDeviceHistoryAsync(
            request.MacAddress,
            request.Limit,
            request.EndDate,
            cancellationToken).ConfigureAwait(false);
    }
}
