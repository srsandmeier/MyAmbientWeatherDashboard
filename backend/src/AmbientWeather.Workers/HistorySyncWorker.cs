using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.AmbientApi;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using Microsoft.Extensions.Options;

namespace AmbientWeather.Workers;

/// <summary>
/// Periodically synchronizes recent Ambient Weather history into persistence when configured.
/// </summary>
public sealed partial class HistorySyncWorker(
    IAmbientRestClient ambientRestClient,
    IServiceProvider serviceProvider,
    IOptions<HistorySyncWorkerOptions> options,
    ILogger<HistorySyncWorker> logger) : BackgroundService
{
    private readonly HistorySyncWorkerOptions _options = options.Value;

    /// <inheritdoc />
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        LogWorkerStarted(logger, DateTimeOffset.UtcNow);

        while (!stoppingToken.IsCancellationRequested)
        {
            await SyncOnceAsync(stoppingToken).ConfigureAwait(false);
            await Task.Delay(GetInterval(), stoppingToken).ConfigureAwait(false);
        }
    }

    /// <summary>
    /// Executes one sync attempt.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>A task that completes when the sync attempt has finished.</returns>
    public async Task SyncOnceAsync(CancellationToken cancellationToken = default)
    {
        if (!_options.Enabled)
        {
            LogSyncDisabled(logger);
            return;
        }

        using var scope = serviceProvider.CreateScope();
        var repository = scope.ServiceProvider.GetService<IWeatherReadingRepository>();
        if (repository == null)
        {
            LogReadingRepositoryMissing(logger);
            return;
        }

        if (!string.IsNullOrWhiteSpace(_options.DeviceMacAddress))
        {
            if (!MacAddressValidator.IsValid(_options.DeviceMacAddress))
            {
                LogInvalidMacAddressConfig(logger);
                return;
            }

            if (string.IsNullOrWhiteSpace(_options.ApiKey) || string.IsNullOrWhiteSpace(_options.ApplicationKey))
            {
                LogConfiguredDeviceCredentialsMissing(logger);
                return;
            }

            await SyncConfiguredDeviceAsync(repository, cancellationToken).ConfigureAwait(false);
            return;
        }

        var targetRepository = scope.ServiceProvider.GetService<IHistorySyncTargetRepository>();
        if (targetRepository == null)
        {
            LogTargetRepositoryMissing(logger);
            return;
        }

        await SyncConfiguredTargetsAsync(repository, targetRepository, cancellationToken).ConfigureAwait(false);
    }

    private async Task SyncConfiguredDeviceAsync(
        IWeatherReadingRepository repository,
        CancellationToken cancellationToken)
    {
        try
        {
            var history = await ambientRestClient.GetDeviceHistoryAsync(
                _options.DeviceMacAddress!,
                _options.ApiKey!,
                _options.ApplicationKey!,
                Math.Clamp(_options.Limit, 1, 288),
                null,
                cancellationToken).ConfigureAwait(false);

            var readings = history.Readings
                .Select(reading => MapReading(_options.DeviceMacAddress!, reading))
                .ToList();

            await repository.AddReadingsAsync(readings, cancellationToken).ConfigureAwait(false);

            LogReadingsStored(logger, readings.Count, _options.DeviceMacAddress!);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            LogSyncFailedForDevice(logger, ex, _options.DeviceMacAddress!);
        }
    }

    private async Task SyncConfiguredTargetsAsync(
        IWeatherReadingRepository repository,
        IHistorySyncTargetRepository targetRepository,
        CancellationToken cancellationToken)
    {
        var targets = await targetRepository.GetEnabledTargetsAsync(cancellationToken).ConfigureAwait(false);
        if (targets.Count == 0)
        {
            LogNoTargetsFound(logger);
            return;
        }

        foreach (var target in targets)
        {
            await SyncTargetAsync(repository, target, cancellationToken).ConfigureAwait(false);
        }
    }

    private async Task SyncTargetAsync(
        IWeatherReadingRepository repository,
        HistorySyncTarget target,
        CancellationToken cancellationToken)
    {
        try
        {
            var history = await ambientRestClient.GetDeviceHistoryAsync(
                target.MacAddress,
                target.ApiKey,
                target.ApplicationKey,
                Math.Clamp(_options.Limit, 1, 288),
                null,
                cancellationToken).ConfigureAwait(false);

            var readings = history.Readings
                .Select(reading => MapReading(target.MacAddress, reading))
                .ToList();

            await repository.AddReadingsAsync(readings, cancellationToken).ConfigureAwait(false);

            LogReadingsStoredForStation(logger, readings.Count, target.StationId);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            LogSyncFailedForStation(logger, ex, target.StationId);
        }
    }

    private TimeSpan GetInterval()
    {
        return TimeSpan.FromSeconds(Math.Max(_options.IntervalSeconds, 1));
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "HistorySyncWorker started at {Time}.")]
    private static partial void LogWorkerStarted(ILogger logger, DateTimeOffset time);

    [LoggerMessage(Level = LogLevel.Debug, Message = "History sync is disabled.")]
    private static partial void LogSyncDisabled(ILogger logger);

    [LoggerMessage(Level = LogLevel.Warning, Message = "History sync skipped because IWeatherReadingRepository is not registered.")]
    private static partial void LogReadingRepositoryMissing(ILogger logger);

    [LoggerMessage(Level = LogLevel.Warning, Message = "History sync skipped because HistorySync:DeviceMacAddress is invalid.")]
    private static partial void LogInvalidMacAddressConfig(ILogger logger);

    [LoggerMessage(Level = LogLevel.Warning, Message = "History sync skipped because configured-device sync requires server-side HistorySync:ApiKey and HistorySync:ApplicationKey values.")]
    private static partial void LogConfiguredDeviceCredentialsMissing(ILogger logger);

    [LoggerMessage(Level = LogLevel.Warning, Message = "History sync skipped because IHistorySyncTargetRepository is not registered.")]
    private static partial void LogTargetRepositoryMissing(ILogger logger);

    [LoggerMessage(Level = LogLevel.Information, Message = "History sync stored {Count} readings for device {DeviceMacAddress}.")]
    private static partial void LogReadingsStored(ILogger logger, int count, string deviceMacAddress);

    [LoggerMessage(Level = LogLevel.Debug, Message = "History sync skipped because no enabled per-user station targets were found.")]
    private static partial void LogNoTargetsFound(ILogger logger);

    [LoggerMessage(Level = LogLevel.Information, Message = "History sync stored {Count} readings for station {StationId}.")]
    private static partial void LogReadingsStoredForStation(ILogger logger, int count, Guid stationId);

    [LoggerMessage(Level = LogLevel.Error, Message = "History sync failed for device {DeviceMacAddress}.")]
    private static partial void LogSyncFailedForDevice(ILogger logger, Exception exception, string deviceMacAddress);

    [LoggerMessage(Level = LogLevel.Error, Message = "History sync failed for station {StationId}.")]
    private static partial void LogSyncFailedForStation(ILogger logger, Exception exception, Guid stationId);

    private static WeatherReading MapReading(string deviceMacAddress, WeatherReadingDto reading)
    {
        return new WeatherReading
        {
            DeviceMacAddress = MacAddressValidator.Normalize(deviceMacAddress),
            DateUtc = reading.DateUtc,
            CreatedAtUtc = DateTimeOffset.FromUnixTimeMilliseconds(reading.DateUtc).UtcDateTime,
            TempInF = reading.TempInF,
            TempF = reading.TempF,
            FeelsLike = reading.FeelsLike,
            FeelsLikeIn = reading.FeelsLikeIn,
            HumidityIn = reading.HumidityIn,
            Humidity = reading.Humidity,
            DewPoint = reading.DewPoint,
            DewPointIn = reading.DewPointIn,
            BaromRelIn = reading.BaromRelIn,
            BaromAbsIn = reading.BaromAbsIn,
            WindDir = reading.WindDir,
            WindSpeedMph = reading.WindSpeedMph,
            WindGustMph = reading.WindGustMph,
            MaxDailyGust = reading.MaxDailyGust,
            HourlyRainIn = reading.HourlyRainIn,
            EventRainIn = reading.EventRainIn,
            DailyRainIn = reading.DailyRainIn,
            WeeklyRainIn = reading.WeeklyRainIn,
            MonthlyRainIn = reading.MonthlyRainIn,
            YearlyRainIn = reading.YearlyRainIn,
            TotalRainIn = reading.TotalRainIn,
            SolarRadiation = reading.SolarRadiation,
            Uv = reading.Uv,
            BattOut = reading.BattOut,
            Tz = reading.Tz,
            LastRain = reading.LastRain,
            Date = reading.Date,
            StoredAtUtc = DateTime.UtcNow
        };
    }
}
