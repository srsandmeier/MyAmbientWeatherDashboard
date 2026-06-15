using AmbientWeather.Application.DTOs.Metrics;
using MediatR;

namespace AmbientWeather.Application.Features.Metrics.Queries;

/// <summary>
/// Query for user-facing metric history from an owned Ambient Weather station.
/// </summary>
/// <param name="MetricKey">User-facing metric key (e.g., <c>outdoor_temp</c>).</param>
/// <param name="Range">Preset range or <c>custom</c> / <c>date</c>. Accepted: 24h, 7d, 30d, 90d, 1y, custom, date.</param>
/// <param name="DeviceId">Optional MAC address of an owned station. Omit to use the user's default station.</param>
/// <param name="From">ISO date/time start boundary for <c>range=custom</c>.</param>
/// <param name="To">ISO date/time end boundary for <c>range=custom</c>.</param>
/// <param name="Date">Calendar date in <c>YYYY-MM-DD</c> format for <c>range=date</c>.</param>
/// <param name="Granularity">Aggregation resolution: <c>auto</c>, <c>raw</c>, <c>hour</c>, or <c>day</c>. Defaults to <c>auto</c>.</param>
/// <param name="Source">Data source identifier. Only <c>my</c> is accepted in Phase 8.</param>
public record GetMetricHistoryQuery(
    string MetricKey,
    string Range,
    string? DeviceId,
    string? From,
    string? To,
    string? Date,
    string? Granularity,
    string? Source) : IRequest<MetricHistoryResponseDto>;
