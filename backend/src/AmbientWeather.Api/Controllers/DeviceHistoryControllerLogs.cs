using Microsoft.Extensions.Logging;

namespace AmbientWeather.Api.Controllers;

internal static partial class DeviceHistoryControllerLogs
{
    [LoggerMessage(
        EventId = 2000,
        Level = LogLevel.Information,
        Message = "Device history requested - MAC: {MacAddress}, Limit: {Limit}, EndDate: {EndDate:yyyy-MM-dd}")]
    public static partial void DeviceHistoryRequested(
        ILogger logger,
        string macAddress,
        int limit,
        DateTime? endDate);

    [LoggerMessage(
        EventId = 2001,
        Level = LogLevel.Information,
        Message = "Device history retrieved successfully - MAC: {MacAddress}, Records: {Count}")]
    public static partial void DeviceHistoryRetrieved(ILogger logger, string macAddress, int count);

    [LoggerMessage(
        EventId = 2002,
        Level = LogLevel.Information,
        Message = "Device history request cancelled for MAC: {MacAddress}")]
    public static partial void DeviceHistoryRequestCancelled(ILogger logger, string macAddress);

    [LoggerMessage(
        EventId = 2003,
        Level = LogLevel.Information,
        Message = "Cache invalidation requested for device: {MacAddress}")]
    public static partial void CacheInvalidationRequested(ILogger logger, string macAddress);

    [LoggerMessage(
        EventId = 2004,
        Level = LogLevel.Information,
        Message = "Cache invalidated for device: {MacAddress}")]
    public static partial void CacheInvalidated(ILogger logger, string macAddress);

    [LoggerMessage(EventId = 2005, Level = LogLevel.Warning, Message = "Invalid MAC address format: {MacAddress}")]
    public static partial void InvalidMacAddress(ILogger logger, string macAddress);

    [LoggerMessage(EventId = 2006, Level = LogLevel.Warning, Message = "Invalid limit parameter: {Limit}")]
    public static partial void InvalidLimit(ILogger logger, int limit);

    [LoggerMessage(EventId = 2007, Level = LogLevel.Warning, Message = "End date in future: {EndDate}")]
    public static partial void FutureDateRejected(ILogger logger, DateTime? endDate);

    [LoggerMessage(EventId = 2008, Level = LogLevel.Warning, Message = "No data found for device: {MacAddress}")]
    public static partial void DeviceNotFound(ILogger logger, string macAddress);

    [LoggerMessage(EventId = 2009, Level = LogLevel.Warning, Message = "Argument validation failed for device: {MacAddress}")]
    public static partial void ArgumentValidationFailed(ILogger logger, Exception exception, string macAddress);

    [LoggerMessage(EventId = 2010, Level = LogLevel.Error, Message = "Failed to retrieve device history from Ambient Weather API.")]
    public static partial void AmbientApiUnavailable(ILogger logger, Exception exception);

    [LoggerMessage(EventId = 2011, Level = LogLevel.Error, Message = "Unexpected error retrieving device history for MAC: {MacAddress}")]
    public static partial void UnexpectedHistoryError(ILogger logger, Exception exception, string macAddress);

    [LoggerMessage(EventId = 2012, Level = LogLevel.Warning, Message = "Invalid MAC address format for cache invalidation: {MacAddress}")]
    public static partial void InvalidMacAddressForCacheInvalidation(ILogger logger, string macAddress);
}
