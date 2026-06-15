using System.Globalization;
using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.Metrics;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using MediatR;

namespace AmbientWeather.Application.Features.Metrics.Queries;

/// <summary>
/// Handles <see cref="GetMetricHistoryQuery"/> by resolving the target station, credentials,
/// UTC window, and granularity, then delegating paging and caching to <see cref="IAmbientHistoryService"/>.
/// </summary>
public sealed class GetMetricHistoryQueryHandler(
    ICurrentUserService currentUserService,
    IAmbientCredentialStore credentialStore,
    IUserStationStore stationStore,
    IUserPreferencesStore preferencesStore,
    IAmbientHistoryService historyService) : IRequestHandler<GetMetricHistoryQuery, MetricHistoryResponseDto>
{
    /// <inheritdoc />
    public async Task<MetricHistoryResponseDto> Handle(
        GetMetricHistoryQuery request,
        CancellationToken cancellationToken)
    {
        var subject = currentUserService.RequireAuthenticatedUser();

        var credentials = await credentialStore.GetAsync(subject, cancellationToken).ConfigureAwait(false)
            ?? throw new AmbientCredentialsRequiredException();

        var station = await ResolveStationAsync(request, subject, cancellationToken).ConfigureAwait(false)
            ?? throw new AmbientStationsRequiredException(
                "No station is configured. Sync your devices in Settings and ensure a default station is selected.");

        var prefs = await preferencesStore
            .GetOrCreateAsync(subject, currentUserService.Email, cancellationToken)
            .ConfigureAwait(false);

        var (fromUtc, toUtc) = ResolveUtcWindow(request, prefs.DailyExtremaTimezone, station.Tz);
        var granularity = ResolveGranularity(request.Granularity, toUtc - fromUtc);

        return await historyService.GetHistoryAsync(
            station.MacAddress,
            station.Nickname ?? station.Name,
            request.MetricKey,
            fromUtc,
            toUtc,
            granularity,
            request.Range,
            subject,
            cancellationToken).ConfigureAwait(false);
    }

    private async Task<WeatherStation?> ResolveStationAsync(
        GetMetricHistoryQuery request,
        string subject,
        CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(request.DeviceId))
        {
            var station = await stationStore.GetOwnedStationByMacAsync(
                subject,
                request.DeviceId,
                cancellationToken).ConfigureAwait(false);

            if (station == null)
            {
                throw new AmbientApiNotFoundException(
                    $"Device '{request.DeviceId}' was not found or does not belong to your account.");
            }

            return station;
        }

        return await stationStore.GetDefaultStationAsync(subject, cancellationToken).ConfigureAwait(false);
    }

    internal static (DateTime fromUtc, DateTime toUtc) ResolveUtcWindow(
        GetMetricHistoryQuery request,
        string tzPreference = "utc",
        string? stationTz = null)
    {
        var now = DateTime.UtcNow;

        return request.Range.ToLowerInvariant() switch
        {
            "24h" => (now.AddHours(-24), now),
            "7d" => (now.AddDays(-7), now),
            "30d" => (now.AddDays(-30), now),
            "90d" => (now.AddDays(-90), now),
            "1y" => (now.AddDays(-365), now),
            "custom" => ParseCustomRange(request.From!, request.To!),
            "date" => ResolveDateRangeUtc(request.Date!, tzPreference, stationTz),
            _ => throw new InvalidOperationException($"Unsupported range value '{request.Range}'. This should have been caught by validation."),
        };
    }

    private static (DateTime fromUtc, DateTime toUtc) ParseCustomRange(string from, string to) =>
        (DateTime.Parse(from, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal),
         DateTime.Parse(to, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal));

    /// <summary>
    /// Resolves a <c>YYYY-MM-DD</c> calendar date to UTC midnight-to-midnight boundaries.
    /// When <paramref name="tzPreference"/> is <c>local</c> and a valid IANA <paramref name="stationTz"/>
    /// is provided, the boundaries are computed relative to local midnight; otherwise falls back to UTC.
    /// </summary>
    internal static (DateTime fromUtc, DateTime toUtc) ResolveDateRangeUtc(
        string date,
        string tzPreference,
        string? stationTz)
    {
        var localDay = DateTime.ParseExact(
            date,
            "yyyy-MM-dd",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None);

        if (tzPreference.Equals("local", StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrWhiteSpace(stationTz))
        {
            try
            {
                var tz = TimeZoneInfo.FindSystemTimeZoneById(stationTz);
                var localMidnight = new DateTime(localDay.Year, localDay.Month, localDay.Day, 0, 0, 0, DateTimeKind.Unspecified);
                var fromUtc = TimeZoneInfo.ConvertTimeToUtc(localMidnight, tz);
                var toUtc = TimeZoneInfo.ConvertTimeToUtc(localMidnight.AddDays(1).AddTicks(-1), tz);
                return (fromUtc, toUtc);
            }
            catch (TimeZoneNotFoundException)
            {
                // Fall through to UTC.
            }
        }

        var dayUtc = DateTime.SpecifyKind(localDay.Date, DateTimeKind.Utc);
        return (dayUtc, dayUtc.AddDays(1).AddTicks(-1));
    }

    internal static string ResolveGranularity(string? requested, TimeSpan span) =>
        requested?.ToLowerInvariant() switch
        {
            "raw" => "raw",
            "hour" => "hour",
            "day" => "day",
            null or "auto" => span.TotalHours switch
            {
                <= 48 => "raw",
                <= 720 => "hour",  // up to 30 days
                _ => "day",
            },
            _ => "raw",
        };

}
