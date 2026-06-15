using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;

namespace AmbientWeather.Api.Middleware;

/// <summary>
/// Applies HTTP security headers to every response:
/// CSP, HSTS (production only), COOP, X-Frame-Options, X-Content-Type-Options,
/// Referrer-Policy, and Permissions-Policy.
/// </summary>
public sealed class SecurityHeadersMiddleware(RequestDelegate next, IWebHostEnvironment env)
{
    /// <summary>CSP used in production — no unsafe-eval, script-src locked to 'self'.</summary>
    private static readonly string ProductionCsp = BuildCsp(isDevelopment: false);

    /// <summary>CSP used in development — relaxed for Vite HMR and source-map eval.</summary>
    private static readonly string DevelopmentCsp = BuildCsp(isDevelopment: true);

    /// <inheritdoc />
    public async Task InvokeAsync(HttpContext context)
    {
        var h = context.Response.Headers;

        // Prevent MIME-type sniffing.
        h["X-Content-Type-Options"] = "nosniff";

        // Clickjacking — also enforced via CSP frame-ancestors below.
        h["X-Frame-Options"] = "DENY";

        // Isolate the browsing context from cross-origin documents.
        h["Cross-Origin-Opener-Policy"] = "same-origin";

        // Limit referrer data sent to third parties.
        h["Referrer-Policy"] = "strict-origin-when-cross-origin";

        // Disable browser features the app does not use.
        h["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()";

        // HSTS — only meaningful over HTTPS; omit in development to allow plain HTTP.
        if (!env.IsDevelopment())
        {
            h["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains";
        }

        // CSP — relaxed in development to support Vite HMR / eval source maps.
        h["Content-Security-Policy"] = env.IsDevelopment() ? DevelopmentCsp : ProductionCsp;

        await next(context).ConfigureAwait(false);
    }

    private static string BuildCsp(bool isDevelopment)
    {
        // Auth0 needs frame-src for silent token refresh iframes.
        const string Auth0Wildcard = "https://*.auth0.com";

        // Azure Monitor / Application Insights telemetry endpoints.
        const string AzureMonitor =
            "https://dc.applicationinsights.azure.com " +
            "https://*.monitor.azure.com " +
            "https://*.applicationinsights.azure.com";

        var scriptSrc = isDevelopment
            ? "'self' 'unsafe-inline' 'unsafe-eval'"  // Vite HMR + eval source maps
            : "'self'";

        var connectSrc = isDevelopment
            ? $"'self' ws://localhost:* http://localhost:* {Auth0Wildcard}"
            : $"'self' {Auth0Wildcard} {AzureMonitor}";

        return string.Join("; ", [
            "default-src 'self'",
            $"script-src {scriptSrc}",
            "style-src 'self' 'unsafe-inline'",   // Tailwind CSS variables require unsafe-inline
            $"connect-src {connectSrc}",
            "img-src 'self' data: blob:",
            "font-src 'self'",
            $"frame-src {Auth0Wildcard}",           // Auth0 silent-auth iframe
            "frame-ancestors 'none'",               // Clickjacking — no embedding allowed
            "form-action 'self'",
            "base-uri 'self'",
            "object-src 'none'",
        ]);
    }
}
