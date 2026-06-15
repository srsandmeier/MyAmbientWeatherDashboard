using Serilog.Core;
using Serilog.Events;

namespace AmbientWeather.Api.Logging;

/// <summary>
/// Serilog enricher that replaces the value of any structured-logging property whose name
/// appears on <see cref="SensitiveLogRedactor"/>'s deny-list with <c>[REDACTED]</c>.
/// Register with <c>.Enrich.With&lt;SensitivePropertyRedactor&gt;()</c>.
/// </summary>
public sealed class SensitivePropertyRedactor : ILogEventEnricher
{
    /// <inheritdoc/>
    public void Enrich(LogEvent logEvent, ILogEventPropertyFactory propertyFactory)
    {
        foreach (var key in logEvent.Properties.Keys.Where(SensitiveLogRedactor.IsSensitiveKey).ToList())
        {
            logEvent.AddOrUpdateProperty(
                propertyFactory.CreateProperty(key, SensitiveLogRedactor.RedactedPlaceholder));
        }
    }
}
