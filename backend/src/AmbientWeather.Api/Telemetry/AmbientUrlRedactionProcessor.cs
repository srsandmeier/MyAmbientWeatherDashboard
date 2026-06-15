using System.Diagnostics;
using OpenTelemetry;

namespace AmbientWeather.Api.Telemetry;

/// <summary>
/// OpenTelemetry processor that strips the query string from any HTTP dependency span
/// targeting an Ambient Weather host. Ambient API URLs carry <c>apiKey</c> and
/// <c>applicationKey</c> as query parameters; those must never appear in telemetry.
/// </summary>
internal sealed class AmbientUrlRedactionProcessor : BaseProcessor<Activity>
{
    private const string AmbientDomainSuffix = "ambientweather.net";

    // Both old (http.url) and new (url.full) OTEL HTTP semantic convention attribute names.
    private static readonly string[] UrlTagNames = ["http.url", "url.full"];

    /// <inheritdoc/>
    public override void OnEnd(Activity activity)
    {
        foreach (var tag in UrlTagNames)
        {
            if (activity.GetTagItem(tag) is not string url) continue;
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)) continue;
            if (!uri.Host.EndsWith(AmbientDomainSuffix, StringComparison.OrdinalIgnoreCase)) continue;

            activity.SetTag(tag, uri.GetLeftPart(UriPartial.Path) + "?[REDACTED]");
            return;
        }
    }
}
