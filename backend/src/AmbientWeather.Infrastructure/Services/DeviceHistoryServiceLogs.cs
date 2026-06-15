using Microsoft.Extensions.Logging;

namespace AmbientWeather.Infrastructure.Services;

internal static partial class DeviceHistoryServiceLogs
{
    [LoggerMessage(
        EventId = 1000,
        Level = LogLevel.Information,
        Message = "Device history for {MacAddress} retrieved from cache.")]
    public static partial void DeviceHistoryRetrievedFromCache(ILogger logger, string macAddress);

    [LoggerMessage(
        EventId = 1001,
        Level = LogLevel.Information,
        Message = "Fetching device history for {MacAddress} with limit {Limit} and endDate {EndDate:yyyy-MM-dd}.")]
    public static partial void FetchingDeviceHistory(
        ILogger logger,
        string macAddress,
        int limit,
        DateTime? endDate);

    [LoggerMessage(
        EventId = 1002,
        Level = LogLevel.Information,
        Message = "Device history for {MacAddress} cached successfully. Records: {Count}")]
    public static partial void DeviceHistoryCached(ILogger logger, string macAddress, int count);

    [LoggerMessage(
        EventId = 1003,
        Level = LogLevel.Information,
        Message = "Cache invalidated for device {MacAddress}.")]
    public static partial void CacheInvalidated(ILogger logger, string macAddress);

    [LoggerMessage(EventId = 1004, Level = LogLevel.Error, Message = "Failed to fetch device history for {MacAddress} from Ambient Weather API.")]
    public static partial void FetchHistoryFailed(ILogger logger, Exception exception, string macAddress);

    [LoggerMessage(EventId = 1005, Level = LogLevel.Warning, Message = "Failed to retrieve cached device history for {MacAddress}.")]
    public static partial void CacheRetrievalFailed(ILogger logger, Exception exception, string macAddress);

    [LoggerMessage(EventId = 1006, Level = LogLevel.Warning, Message = "Failed to invalidate cache for device {MacAddress}.")]
    public static partial void CacheInvalidationFailed(ILogger logger, Exception exception, string macAddress);

    [LoggerMessage(EventId = 1007, Level = LogLevel.Information, Message = "All device history caches invalidated.")]
    public static partial void AllCachesInvalidated(ILogger logger);

    [LoggerMessage(EventId = 1008, Level = LogLevel.Warning, Message = "Failed to invalidate all device history caches.")]
    public static partial void AllCachesInvalidationFailed(ILogger logger, Exception exception);

    [LoggerMessage(EventId = 1009, Level = LogLevel.Warning, Message = "Failed to cache device history for {MacAddress}.")]
    public static partial void CacheWriteFailed(ILogger logger, Exception exception, string macAddress);
}
