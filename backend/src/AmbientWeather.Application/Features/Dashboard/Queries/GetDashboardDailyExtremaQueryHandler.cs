using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.AmbientApi;
using AmbientWeather.Application.DTOs.Dashboard;
using AmbientWeather.Application.Interfaces;
using MediatR;
using Microsoft.Extensions.Logging;

namespace AmbientWeather.Application.Features.Dashboard.Queries;

/// <summary>
/// Handler for <see cref="GetDashboardDailyExtremaQuery"/>.
/// Primary path: queries stored <c>WeatherReading</c> rows for today's calendar day.
/// Fallback path: when the local DB has no readings for today (sync has not yet run),
/// calls the Ambient REST history API and computes extrema from the response.
/// The calendar day is computed in UTC or in the station's IANA timezone (stored on
/// <see cref="WeatherStation.Tz"/> during device sync) depending on the user's
/// <c>DailyExtremaTimezone</c> preference. Falls back to UTC when the timezone is unknown.
/// </summary>
internal sealed partial class GetDashboardDailyExtremaQueryHandler
    : IRequestHandler<GetDashboardDailyExtremaQuery, DailyExtremaDto>
{
    private readonly ICurrentUserService _currentUserService;
    private readonly IAmbientCredentialStore _credentialStore;
    private readonly IUserStationStore _stationStore;
    private readonly IUserPreferencesStore _preferencesStore;
    private readonly IWeatherReadingRepository _readingRepository;
    private readonly IAmbientRestClient _restClient;
    private readonly ILogger<GetDashboardDailyExtremaQueryHandler> _logger;

    /// <summary>Initializes the handler.</summary>
    public GetDashboardDailyExtremaQueryHandler(
        ICurrentUserService currentUserService,
        IAmbientCredentialStore credentialStore,
        IUserStationStore stationStore,
        IUserPreferencesStore preferencesStore,
        IWeatherReadingRepository readingRepository,
        IAmbientRestClient restClient,
        ILogger<GetDashboardDailyExtremaQueryHandler> logger)
    {
        _currentUserService = currentUserService;
        _credentialStore = credentialStore;
        _stationStore = stationStore;
        _preferencesStore = preferencesStore;
        _readingRepository = readingRepository;
        _restClient = restClient;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<DailyExtremaDto> Handle(
        GetDashboardDailyExtremaQuery request,
        CancellationToken cancellationToken)
    {
        var subject = _currentUserService.RequireAuthenticatedUser();

        var credentials = await _credentialStore.GetAsync(subject, cancellationToken)
            .ConfigureAwait(false);
        if (credentials is null)
            throw new AmbientCredentialsRequiredException();

        var station = await _stationStore.GetDefaultStationAsync(subject, cancellationToken)
            .ConfigureAwait(false);
        if (station is null)
            throw new AmbientStationsRequiredException();

        // Determine day boundaries based on the user's timezone preference.
        var prefs = await _preferencesStore
            .GetOrCreateAsync(subject, _currentUserService.Email, cancellationToken)
            .ConfigureAwait(false);

        var utcNow = DateTime.UtcNow;
        var dayForQuery = ResolveDayUtc(prefs.DailyExtremaTimezone, station.Tz, utcNow);

        var (highF, lowF, highInF, lowInF) = await _readingRepository
            .GetDailyTempExtremaAsync(station.MacAddress, dayForQuery, cancellationToken)
            .ConfigureAwait(false);

        // DB had no readings for today — fall back to Ambient REST history.
        if (highF is null && lowF is null && highInF is null && lowInF is null)
        {
            (highF, lowF, highInF, lowInF) = await GetExtremaFromRestAsync(
                credentials, station.MacAddress, dayForQuery, cancellationToken)
                .ConfigureAwait(false);
        }

        return new DailyExtremaDto
        {
            DeviceId = station.MacAddress,
            DeviceName = station.Nickname ?? station.Name,
            DateUtc = dayForQuery.Date,
            DailyHighTempF = highF,
            DailyLowTempF = lowF,
            DailyHighTempInF = highInF,
            DailyLowTempInF = lowInF,
        };
    }

    /// <summary>
    /// Returns a <see cref="DateTime"/> whose <c>.Date</c> represents today in the appropriate
    /// timezone. For <c>utc</c> preference this is simply <paramref name="utcNow"/>.
    /// For <c>local</c> preference the station's IANA timezone string (stored during device sync)
    /// is used; falls back silently to UTC when the timezone is null, empty, or unrecognised.
    /// </summary>
    private static DateTime ResolveDayUtc(string preference, string? stationTz, DateTime utcNow)
    {
        if (!preference.Equals("local", StringComparison.OrdinalIgnoreCase))
            return utcNow;

        if (string.IsNullOrWhiteSpace(stationTz))
            return utcNow;

        try
        {
            var tz = TimeZoneInfo.FindSystemTimeZoneById(stationTz);
            return TimeZoneInfo.ConvertTimeFromUtc(utcNow, tz);
        }
        catch (TimeZoneNotFoundException)
        {
            return utcNow;
        }
    }

    private async Task<(double? HighF, double? LowF, double? HighInF, double? LowInF)> GetExtremaFromRestAsync(
        AmbientCredentials credentials,
        string macAddress,
        DateTime utcNow,
        CancellationToken cancellationToken)
    {
        DeviceHistoryResponseDto history;
        try
        {
            history = await _restClient.GetDeviceHistoryAsync(
                macAddress,
                credentials.ApiKey,
                credentials.ApplicationKey,
                limit: 288,
                endDate: utcNow,
                cancellationToken)
                .ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogRestExtremaFallbackFailed(_logger, ex);
            return (null, null, null, null);
        }

        var todayStartMs = new DateTimeOffset(utcNow.Date, TimeSpan.Zero).ToUnixTimeMilliseconds();
        var todaysReadings = (history.Readings ?? [])
            .Where(r => r.DateUtc >= todayStartMs)
            .ToList();

        if (todaysReadings.Count == 0)
            return (null, null, null, null);

        var highF = todaysReadings.Max(r => r.TempF);
        var lowF = todaysReadings.Min(r => r.TempF);
        var highInF = todaysReadings.Max(r => r.TempInF);
        var lowInF = todaysReadings.Min(r => r.TempInF);

        return (highF, lowF, highInF, lowInF);
    }

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "Failed to retrieve daily extrema from REST fallback.")]
    private static partial void LogRestExtremaFallbackFailed(ILogger logger, Exception ex);
}
