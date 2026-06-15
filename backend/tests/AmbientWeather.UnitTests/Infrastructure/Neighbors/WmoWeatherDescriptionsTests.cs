using AmbientWeather.Infrastructure.Neighbors;
using Shouldly;
using Xunit;

namespace AmbientWeather.UnitTests.Infrastructure.Neighbors;

public sealed class WmoWeatherDescriptionsTests
{
    [Theory]
    [InlineData(0, "Clear sky")]
    [InlineData(1, "Mainly clear")]
    [InlineData(2, "Partly cloudy")]
    [InlineData(3, "Overcast")]
    [InlineData(45, "Fog")]
    [InlineData(48, "Rime fog")]
    [InlineData(51, "Light drizzle")]
    [InlineData(61, "Light rain")]
    [InlineData(63, "Moderate rain")]
    [InlineData(65, "Heavy rain")]
    [InlineData(71, "Light snow")]
    [InlineData(80, "Light showers")]
    [InlineData(95, "Thunderstorm")]
    [InlineData(99, "Thunderstorm with heavy hail")]
    public void KnownCodesReturnExpectedDescription(int code, string expected)
    {
        WmoWeatherDescriptions.Describe(code).ShouldBe(expected);
    }

    [Theory]
    [InlineData(null)]
    [InlineData(100)]
    [InlineData(-1)]
    [InlineData(50)]
    public void UnknownOrNullCodeReturnsNull(int? code)
    {
        WmoWeatherDescriptions.Describe(code).ShouldBeNull();
    }
}
