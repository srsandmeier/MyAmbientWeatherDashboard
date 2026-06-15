using System.Net;
using System.Text.Json;
using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.Common;
using FluentValidation;

namespace AmbientWeather.Api.Middleware;

/// <summary>
/// Converts unhandled exceptions into safe, consistent API error responses.
/// Handles <see cref="ExpectedApplicationException"/> subclasses centrally so individual
/// controllers do not need per-type catch blocks for domain exceptions.
/// </summary>
public sealed partial class GlobalExceptionHandlerMiddleware(
    RequestDelegate next,
    ILogger<GlobalExceptionHandlerMiddleware> logger)
{
    /// <summary>
    /// Processes the HTTP request and handles unhandled exceptions.
    /// </summary>
    /// <param name="context">The current HTTP context.</param>
    /// <returns>A task that completes when the request has been processed.</returns>
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context).ConfigureAwait(false);
        }
        catch (AuthenticatedUserRequiredException ex) when (!context.Response.HasStarted)
        {
            await WriteErrorAsync(context, StatusCodes.Status401Unauthorized, "authenticated-user-required", ex.Message).ConfigureAwait(false);
        }
        catch (AmbientCredentialsRequiredException ex) when (!context.Response.HasStarted)
        {
            await WriteErrorAsync(context, StatusCodes.Status428PreconditionRequired, "ambient-credentials-required", ex.Message).ConfigureAwait(false);
        }
        catch (AmbientStationsRequiredException ex) when (!context.Response.HasStarted)
        {
            await WriteErrorAsync(context, StatusCodes.Status428PreconditionRequired, "ambient-stations-required", ex.Message).ConfigureAwait(false);
        }
        catch (NeighborsUnavailableException ex) when (!context.Response.HasStarted)
        {
            await WriteErrorAsync(context, StatusCodes.Status428PreconditionRequired, "neighbors-unavailable", ex.Message).ConfigureAwait(false);
        }
        catch (AmbientApiAuthException ex) when (!context.Response.HasStarted)
        {
            await WriteErrorAsync(context, StatusCodes.Status401Unauthorized, "ambient-auth-failed", ex.Message).ConfigureAwait(false);
        }
        catch (AmbientApiNotFoundException ex) when (!context.Response.HasStarted)
        {
            await WriteErrorAsync(context, StatusCodes.Status404NotFound, "ambient-not-found", ex.Message).ConfigureAwait(false);
        }
        catch (AmbientApiRateLimitException ex) when (!context.Response.HasStarted)
        {
            await WriteErrorAsync(context, StatusCodes.Status429TooManyRequests, "ambient-rate-limit", ex.Message).ConfigureAwait(false);
        }
        catch (AmbientCircuitOpenException ex) when (!context.Response.HasStarted)
        {
            await WriteErrorAsync(context, StatusCodes.Status503ServiceUnavailable, "ambient-unavailable", ex.Message).ConfigureAwait(false);
        }
        catch (UnauthorizedAccessException ex) when (!context.Response.HasStarted)
        {
            await WriteErrorAsync(context, StatusCodes.Status403Forbidden, "forbidden", ex.Message).ConfigureAwait(false);
        }
        catch (ValidationException ex) when (!context.Response.HasStarted)
        {
            var message = string.Join("; ", ex.Errors.Select(e => e.ErrorMessage));
            await WriteErrorAsync(context, StatusCodes.Status400BadRequest, "validation-error", message).ConfigureAwait(false);
        }
        catch (OperationCanceledException ex) when (!context.RequestAborted.IsCancellationRequested && !context.Response.HasStarted)
        {
            LogRequestTimedOut(logger, ex, context.Request.Method, context.Request.Path.Value);
            await WriteErrorAsync(
                context,
                StatusCodes.Status504GatewayTimeout,
                "upstream-timeout",
                "A weather data provider did not respond in time. Please try again.").ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            await HandleUnexpectedAsync(context, ex).ConfigureAwait(false);
        }
    }

    private async Task HandleUnexpectedAsync(HttpContext context, Exception ex)
    {
        LogUnhandledException(logger, ex, context.Request.Method, context.Request.Path.Value);

        if (context.Response.HasStarted)
        {
            System.Runtime.ExceptionServices.ExceptionDispatchInfo.Capture(ex).Throw();
            return; // unreachable; satisfies compiler flow analysis
        }

        await WriteErrorAsync(
            context,
            StatusCodes.Status500InternalServerError,
            "internal-server-error",
            "An unexpected error occurred. Please try again later.").ConfigureAwait(false);
    }

    private static async Task WriteErrorAsync(HttpContext context, int statusCode, string error, string message)
    {
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";

        var dto = new ErrorResponseDto { Error = error, Message = message, StatusCode = statusCode };
        await context.Response.WriteAsync(JsonSerializer.Serialize(dto)).ConfigureAwait(false);
    }

    [LoggerMessage(Level = LogLevel.Error, Message = "Unhandled exception while processing {Method} {Path}.")]
    private static partial void LogUnhandledException(ILogger logger, Exception exception, string method, string? path);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Weather provider request timed out while processing {Method} {Path}.")]
    private static partial void LogRequestTimedOut(ILogger logger, Exception exception, string method, string? path);
}
