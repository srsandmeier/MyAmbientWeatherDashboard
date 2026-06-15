using System.Security.Claims;
using AmbientWeather.Api.Services;
using AmbientWeather.Application.Common;
using AmbientWeather.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace AmbientWeather.Api.Hubs;

/// <summary>
/// SignalR hub that delivers realtime weather readings to authenticated browser clients.
/// Each connection is added to a per-user group (<c>user:{userHash}</c>) so the Redis
/// pub/sub subscriber can fan out only to that user's connections.
/// </summary>
[Authorize(Policy = "AuthenticatedUser")]
public sealed partial class WeatherHub(
    IRealtimeReadingSubscriber subscriber,
    IConfiguration configuration,
    IHostEnvironment environment,
    ILogger<WeatherHub> logger) : Hub
{

    /// <inheritdoc />
    public override async Task OnConnectedAsync()
    {
        var userHash = RequireUserHash();
        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(userHash)).ConfigureAwait(false);
        await subscriber.SubscribeAsync(userHash, Context.ConnectionAborted).ConfigureAwait(false);
        await base.OnConnectedAsync().ConfigureAwait(false);
    }

    /// <inheritdoc />
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (Context.User is not null)
        {
            try
            {
                var userHash = RequireUserHash();
                await subscriber.UnsubscribeAsync(userHash).ConfigureAwait(false);
            }
            catch (HubException ex)
            {
                // Token was valid but lacked a NameIdentifier claim; log and continue so
                // base.OnDisconnectedAsync always runs and the connection is fully cleaned up.
                LogMissingClaimOnDisconnect(logger, ex);
            }
        }

        await base.OnDisconnectedAsync(exception).ConfigureAwait(false);
    }

    /// <summary>Returns the SignalR group name for a given user hash.</summary>
    public static string GroupName(string userHash) => $"user:{userHash}";

    private string RequireUserHash()
    {
        // JsonWebTokenHandler (.NET 8+) does not apply the legacy JwtSecurityTokenHandler
        // claim-type map, so "sub" is not automatically promoted to ClaimTypes.NameIdentifier.
        // Check both to support either handler. Fall back to the dev-bypass identity last.
        var subject = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? Context.User?.FindFirstValue("sub")
            ?? (HttpContextCurrentUserService.IsDevBypassActive(environment, configuration) ? HttpContextCurrentUserService.DevSubject : null)
            ?? throw new HubException("Authenticated user identity is missing.");
        return UserSegmentHash.Compute(subject);
    }

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "WeatherHub: NameIdentifier claim absent on disconnect; skipping unsubscribe.")]
    private static partial void LogMissingClaimOnDisconnect(ILogger logger, Exception ex);
}
