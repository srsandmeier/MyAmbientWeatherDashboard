using AmbientWeather.Domain.Entities;

namespace AmbientWeather.Application.Interfaces;

/// <summary>
/// Repository for persisting and retrieving weather readings from the database.
/// </summary>
public interface IWeatherReadingRepository
{
    /// <summary>
    /// Adds a single weather reading to the database.
    /// </summary>
    /// <param name="reading">The weather reading to persist.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    Task AddReadingAsync(WeatherReading reading, CancellationToken cancellationToken = default);

    /// <summary>
    /// Adds multiple weather readings in batch.
    /// More efficient than adding one at a time.
    /// </summary>
    /// <param name="readings">Collection of weather readings to persist.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    Task AddReadingsAsync(
        IEnumerable<WeatherReading> readings,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves weather readings for a specific device within an optional date range.
    /// Results are ordered by DateUtc descending (most recent first).
    /// </summary>
    /// <param name="deviceMacAddress">MAC address of the device.</param>
    /// <param name="limit">Maximum number of readings to return. Default: 288.</param>
    /// <param name="startDate">Optional start date (inclusive).</param>
    /// <param name="endDate">Optional end date (inclusive).</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    Task<IEnumerable<WeatherReading>> GetReadingsByDeviceAsync(
        string deviceMacAddress,
        int limit = 288,
        DateTime? startDate = null,
        DateTime? endDate = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves a single reading by its ID.
    /// </summary>
    /// <param name="readingId">The ID of the reading.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    Task<WeatherReading?> GetReadingByIdAsync(Guid readingId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets the count of readings for a specific device.
    /// </summary>
    /// <param name="deviceMacAddress">MAC address of the device.</param>
    /// <param name="startDate">Optional start date filter.</param>
    /// <param name="endDate">Optional end date filter.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    Task<int> GetReadingCountAsync(
        string deviceMacAddress,
        DateTime? startDate = null,
        DateTime? endDate = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes readings older than the specified date.
    /// Useful for data cleanup and storage management.
    /// </summary>
    /// <param name="cutoffDate">Delete readings before this date (UTC).</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>Number of readings deleted.</returns>
    Task<int> DeleteReadingsBeforeDateAsync(
        DateTime cutoffDate,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns the daily high and low temperatures (outdoor and indoor) for the specified device
    /// on the given UTC calendar day. Returns <see langword="null"/> for any value when no readings
    /// with a valid sensor value exist for that field on that day.
    /// </summary>
    /// <param name="deviceMacAddress">Normalized MAC address of the device.</param>
    /// <param name="dayUtc">Any instant within the target UTC day; only the date portion is used.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task<(double? HighF, double? LowF, double? HighInF, double? LowInF)> GetDailyTempExtremaAsync(
        string deviceMacAddress,
        DateTime dayUtc,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes all readings for a specific device.
    /// </summary>
    /// <param name="deviceMacAddress">MAC address of the device.</param>
    /// <param name="cancellationToken">Cancellation token for async operations.</param>
    /// <returns>Number of readings deleted.</returns>
    Task<int> DeleteReadingsByDeviceAsync(
        string deviceMacAddress,
        CancellationToken cancellationToken = default);
}
