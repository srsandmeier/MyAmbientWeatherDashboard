using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using AmbientWeather.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AmbientWeather.Infrastructure.Repositories;

/// <summary>
/// Entity Framework Core implementation of the weather reading repository.
/// </summary>
public partial class WeatherReadingRepository : IWeatherReadingRepository
{
    private readonly AmbientWeatherDbContext _dbContext;
    private readonly ILogger<WeatherReadingRepository> _logger;

    public WeatherReadingRepository(
        AmbientWeatherDbContext dbContext,
        ILogger<WeatherReadingRepository> logger)
    {
        _dbContext = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <summary>
    /// Adds a single weather reading to the database.
    /// </summary>
    public async Task AddReadingAsync(
        WeatherReading reading,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(reading);

        _dbContext.WeatherReadings.Add(reading);

        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            LogReadingSaved(_logger, reading.DeviceMacAddress, reading.DateUtc);
        }
        catch (Exception ex)
        {
            LogReadingSaveFailed(_logger, ex, reading.DeviceMacAddress);
            throw;
        }
    }

    /// <summary>
    /// Adds multiple weather readings in batch (more efficient).
    /// </summary>
    public async Task AddReadingsAsync(
        IEnumerable<WeatherReading> readings,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(readings);

        var readingsList = readings.ToList();
        if (readingsList.Count == 0)
        {
            return;
        }

        _dbContext.WeatherReadings.AddRange(readingsList);

        try
        {
            var rowsAffected = await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            LogBatchReadingsSaved(_logger, rowsAffected);
        }
        catch (Exception ex)
        {
            LogBatchReadingsSaveFailed(_logger, ex);
            throw;
        }
    }

    /// <summary>
    /// Retrieves weather readings for a specific device, ordered by date descending (most recent first).
    /// </summary>
    public async Task<IEnumerable<WeatherReading>> GetReadingsByDeviceAsync(
        string deviceMacAddress,
        int limit = 288,
        DateTime? startDate = null,
        DateTime? endDate = null,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(deviceMacAddress))
        {
            throw new ArgumentException("Device MAC address cannot be null or empty.", nameof(deviceMacAddress));
        }

        if (limit <= 0)
        {
            throw new ArgumentException("Limit must be greater than 0.", nameof(limit));
        }

        var query = _dbContext.WeatherReadings
            .AsNoTracking()
            .Where(r => r.DeviceMacAddress == deviceMacAddress);

        if (startDate.HasValue)
        {
            query = query.Where(r => r.CreatedAtUtc >= startDate.Value);
        }

        if (endDate.HasValue)
        {
            query = query.Where(r => r.CreatedAtUtc <= endDate.Value);
        }

        var readings = await query
            .OrderByDescending(r => r.DateUtc)
            .Take(limit)
            .ToListAsync(cancellationToken).ConfigureAwait(false);

        LogReadingsRetrieved(_logger, readings.Count, deviceMacAddress);

        return readings;
    }

    /// <summary>
    /// Retrieves a single reading by its ID.
    /// </summary>
    public async Task<WeatherReading?> GetReadingByIdAsync(
        Guid readingId,
        CancellationToken cancellationToken = default)
    {
        var reading = await _dbContext.WeatherReadings
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == readingId, cancellationToken).ConfigureAwait(false);

        return reading;
    }

    /// <summary>
    /// Gets the count of readings for a specific device.
    /// </summary>
    public async Task<int> GetReadingCountAsync(
        string deviceMacAddress,
        DateTime? startDate = null,
        DateTime? endDate = null,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(deviceMacAddress))
        {
            throw new ArgumentException("Device MAC address cannot be null or empty.", nameof(deviceMacAddress));
        }

        var query = _dbContext.WeatherReadings
            .Where(r => r.DeviceMacAddress == deviceMacAddress);

        if (startDate.HasValue)
        {
            query = query.Where(r => r.CreatedAtUtc >= startDate.Value);
        }

        if (endDate.HasValue)
        {
            query = query.Where(r => r.CreatedAtUtc <= endDate.Value);
        }

        var count = await query.CountAsync(cancellationToken).ConfigureAwait(false);

        LogReadingCount(_logger, deviceMacAddress, count);

        return count;
    }

    /// <summary>
    /// Deletes readings older than the specified date (useful for cleanup).
    /// </summary>
    public async Task<int> DeleteReadingsBeforeDateAsync(
        DateTime cutoffDate,
        CancellationToken cancellationToken = default)
    {
        var readingsToDelete = await _dbContext.WeatherReadings
            .Where(r => r.CreatedAtUtc < cutoffDate)
            .CountAsync(cancellationToken).ConfigureAwait(false);

        var rowsAffected = await _dbContext.WeatherReadings
            .Where(r => r.CreatedAtUtc < cutoffDate)
            .ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);

        LogReadingsDeletedByDate(_logger, rowsAffected, cutoffDate);

        return rowsAffected;
    }

    /// <summary>
    /// Deletes all readings for a specific device.
    /// </summary>
    public async Task<int> DeleteReadingsByDeviceAsync(
        string deviceMacAddress,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(deviceMacAddress))
        {
            throw new ArgumentException("Device MAC address cannot be null or empty.", nameof(deviceMacAddress));
        }

        var rowsAffected = await _dbContext.WeatherReadings
            .Where(r => r.DeviceMacAddress == deviceMacAddress)
            .ExecuteDeleteAsync(cancellationToken).ConfigureAwait(false);

        LogReadingsDeletedByDevice(_logger, rowsAffected, deviceMacAddress);

        return rowsAffected;
    }

    /// <summary>
    /// Returns the daily high/low outdoor and indoor temperatures for the given device on the
    /// specified UTC calendar day. Uses a single grouped query for efficiency.
    /// </summary>
    public async Task<(double? HighF, double? LowF, double? HighInF, double? LowInF)> GetDailyTempExtremaAsync(
        string deviceMacAddress,
        DateTime dayUtc,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(deviceMacAddress))
            throw new ArgumentException("Device MAC address cannot be null or empty.", nameof(deviceMacAddress));

        var startMs = new DateTimeOffset(dayUtc.Date, TimeSpan.Zero).ToUnixTimeMilliseconds();
        var endMs = new DateTimeOffset(dayUtc.Date.AddDays(1), TimeSpan.Zero).ToUnixTimeMilliseconds();

        var extrema = await _dbContext.WeatherReadings
            .AsNoTracking()
            .Where(r => r.DeviceMacAddress == deviceMacAddress
                     && r.DateUtc >= startMs
                     && r.DateUtc < endMs)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                HighF = g.Max(r => (double?)r.TempF),
                LowF = g.Min(r => (double?)r.TempF),
                HighInF = g.Max(r => (double?)r.TempInF),
                LowInF = g.Min(r => (double?)r.TempInF),
            })
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        LogDailyExtremaQueried(_logger, deviceMacAddress, dayUtc.Date);

        return extrema is null
            ? (null, null, null, null)
            : (extrema.HighF, extrema.LowF, extrema.HighInF, extrema.LowInF);
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Weather reading saved for device {DeviceMacAddress} at {DateUtc}.")]
    private static partial void LogReadingSaved(ILogger logger, string deviceMacAddress, long dateUtc);

    [LoggerMessage(Level = LogLevel.Error, Message = "Failed to save weather reading for device {DeviceMacAddress}.")]
    private static partial void LogReadingSaveFailed(ILogger logger, Exception exception, string deviceMacAddress);

    [LoggerMessage(Level = LogLevel.Information, Message = "Batch added {RowsAffected} weather readings to database.")]
    private static partial void LogBatchReadingsSaved(ILogger logger, int rowsAffected);

    [LoggerMessage(Level = LogLevel.Error, Message = "Failed to batch add weather readings to database.")]
    private static partial void LogBatchReadingsSaveFailed(ILogger logger, Exception exception);

    [LoggerMessage(Level = LogLevel.Information, Message = "Retrieved {Count} weather readings for device {DeviceMacAddress}.")]
    private static partial void LogReadingsRetrieved(ILogger logger, int count, string deviceMacAddress);

    [LoggerMessage(Level = LogLevel.Information, Message = "Reading count for device {DeviceMacAddress}: {Count}.")]
    private static partial void LogReadingCount(ILogger logger, string deviceMacAddress, int count);

    [LoggerMessage(Level = LogLevel.Information, Message = "Deleted {RowsAffected} weather readings older than {CutoffDate}.")]
    private static partial void LogReadingsDeletedByDate(ILogger logger, int rowsAffected, DateTime cutoffDate);

    [LoggerMessage(Level = LogLevel.Information, Message = "Deleted {RowsAffected} weather readings for device {DeviceMacAddress}.")]
    private static partial void LogReadingsDeletedByDevice(ILogger logger, int rowsAffected, string deviceMacAddress);

    [LoggerMessage(Level = LogLevel.Debug, Message = "Queried daily temperature extrema for device {DeviceMacAddress} on {DayUtc:yyyy-MM-dd}.")]
    private static partial void LogDailyExtremaQueried(ILogger logger, string deviceMacAddress, DateTime dayUtc);
}
