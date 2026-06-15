using AmbientWeather.Api.Logging;
using Serilog;
using Serilog.Core;
using Serilog.Events;
using Shouldly;

namespace AmbientWeather.UnitTests.Api.Logging;

/// <summary>Unit tests for <see cref="SensitivePropertyRedactor"/>.</summary>
public sealed class SensitivePropertyRedactorTests
{
    private sealed class CaptureSink : ILogEventSink
    {
        public List<LogEvent> Events { get; } = [];
        public void Emit(LogEvent logEvent) => Events.Add(logEvent);
    }

    private static (ILogger logger, CaptureSink sink) BuildLogger()
    {
        var sink = new CaptureSink();
        var logger = new LoggerConfiguration()
            .Enrich.With<SensitivePropertyRedactor>()
            .WriteTo.Sink(sink)
            .CreateLogger();
        return (logger, sink);
    }

    private static object? ScalarValue(LogEvent ev, string key) =>
        (ev.Properties[key] as Serilog.Events.ScalarValue)?.Value;

    [Theory]
    [InlineData("apiKey")]
    [InlineData("applicationKey")]
    [InlineData("password")]
    [InlineData("authorization")]
    public void SensitivePropertyIsRedacted(string propertyName)
    {
        var (logger, sink) = BuildLogger();
        logger.Information("Test {" + propertyName + "}", "secret-value");

        var ev = sink.Events.Single();
        ScalarValue(ev, propertyName).ShouldBe(SensitiveLogRedactor.RedactedPlaceholder);
    }

    [Theory]
    [InlineData("stationId")]
    [InlineData("macAddress")]
    [InlineData("userId")]
    public void NonSensitivePropertyIsPreserved(string propertyName)
    {
        var (logger, sink) = BuildLogger();
        logger.Information("Test {" + propertyName + "}", "safe-value");

        var ev = sink.Events.Single();
        ScalarValue(ev, propertyName).ShouldBe("safe-value");
    }

    [Fact]
    public void MixedPropertiesRedactsSensitiveOnly()
    {
        var (logger, sink) = BuildLogger();
        logger.Information("Test {apiKey} {stationId}", "secret-key", "station-123");

        var ev = sink.Events.Single();
        ScalarValue(ev, "apiKey").ShouldBe(SensitiveLogRedactor.RedactedPlaceholder);
        ScalarValue(ev, "stationId").ShouldBe("station-123");
    }
}
