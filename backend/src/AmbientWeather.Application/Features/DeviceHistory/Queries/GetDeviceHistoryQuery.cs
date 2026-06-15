using AmbientWeather.Application.DTOs.AmbientApi;
using MediatR;

namespace AmbientWeather.Application.Features.DeviceHistory.Queries;

/// <summary>
/// Query to retrieve paginated weather history for a specific device.
/// </summary>
/// <param name="MacAddress">The MAC address of the target device.</param>
/// <param name="Limit">Maximum number of readings to return (1–288).</param>
/// <param name="EndDate">Optional upper bound for the readings window.</param>
public record GetDeviceHistoryQuery(
    string MacAddress,
    int Limit,
    DateTime? EndDate) : IRequest<DeviceHistoryResponseDto>;
