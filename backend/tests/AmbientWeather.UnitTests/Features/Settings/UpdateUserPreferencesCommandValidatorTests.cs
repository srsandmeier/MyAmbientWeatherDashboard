using AmbientWeather.Application.Features.Settings.Commands;
using FluentValidation.TestHelper;
using Shouldly;

namespace AmbientWeather.UnitTests.Features.Settings;

public sealed class UpdateUserPreferencesCommandValidatorTests
{
    private readonly UpdateUserPreferencesCommandValidator _validator = new();

    [Theory]
    [InlineData("F")]
    [InlineData("C")]
    public void ValidTemperatureUnitShouldPass(string unit)
    {
        var result = _validator.TestValidate(ValidCommand() with { TemperatureUnit = unit });
        result.ShouldNotHaveValidationErrorFor(x => x.TemperatureUnit);
    }

    [Theory]
    [InlineData("K")]
    [InlineData("")]
    [InlineData("celsius")]
    public void InvalidTemperatureUnitShouldFail(string unit)
    {
        var result = _validator.TestValidate(ValidCommand() with { TemperatureUnit = unit });
        result.ShouldHaveValidationErrorFor(x => x.TemperatureUnit);
    }

    [Theory]
    [InlineData("mph")]
    [InlineData("kmh")]
    [InlineData("ms")]
    public void ValidSpeedUnitShouldPass(string unit)
    {
        var result = _validator.TestValidate(ValidCommand() with { SpeedUnit = unit });
        result.ShouldNotHaveValidationErrorFor(x => x.SpeedUnit);
    }

    [Theory]
    [InlineData("kph")]
    [InlineData("")]
    public void InvalidSpeedUnitShouldFail(string unit)
    {
        var result = _validator.TestValidate(ValidCommand() with { SpeedUnit = unit });
        result.ShouldHaveValidationErrorFor(x => x.SpeedUnit);
    }

    [Theory]
    [InlineData("inhg")]
    [InlineData("hpa")]
    [InlineData("mbar")]
    public void ValidPressureUnitShouldPass(string unit)
    {
        var result = _validator.TestValidate(ValidCommand() with { PressureUnit = unit });
        result.ShouldNotHaveValidationErrorFor(x => x.PressureUnit);
    }

    [Theory]
    [InlineData("in")]
    [InlineData("mm")]
    public void ValidRainfallUnitShouldPass(string unit)
    {
        var result = _validator.TestValidate(ValidCommand() with { RainfallUnit = unit });
        result.ShouldNotHaveValidationErrorFor(x => x.RainfallUnit);
    }

    [Theory]
    [InlineData("mi")]
    [InlineData("km")]
    public void ValidDistanceUnitShouldPass(string unit)
    {
        var result = _validator.TestValidate(ValidCommand() with { DistanceUnit = unit });
        result.ShouldNotHaveValidationErrorFor(x => x.DistanceUnit);
    }

    [Theory]
    [InlineData("miles")]
    [InlineData("")]
    public void InvalidDistanceUnitShouldFail(string unit)
    {
        var result = _validator.TestValidate(ValidCommand() with { DistanceUnit = unit });
        result.ShouldHaveValidationErrorFor(x => x.DistanceUnit);
    }

    [Theory]
    [InlineData("light")]
    [InlineData("dark")]
    [InlineData("system")]
    public void ValidThemeShouldPass(string theme)
    {
        var result = _validator.TestValidate(ValidCommand() with { Theme = theme });
        result.ShouldNotHaveValidationErrorFor(x => x.Theme);
    }

    [Theory]
    [InlineData("auto")]
    [InlineData("")]
    public void InvalidThemeShouldFail(string theme)
    {
        var result = _validator.TestValidate(ValidCommand() with { Theme = theme });
        result.ShouldHaveValidationErrorFor(x => x.Theme);
    }

    [Theory]
    [InlineData("mdy")]
    [InlineData("dmy")]
    [InlineData("iso")]
    public void ValidDateFormatShouldPass(string dateFormat)
    {
        var result = _validator.TestValidate(ValidCommand() with { DateFormat = dateFormat });
        result.ShouldNotHaveValidationErrorFor(x => x.DateFormat);
    }

    [Theory]
    [InlineData("ymd-slash")]
    [InlineData("")]
    public void InvalidDateFormatShouldFail(string dateFormat)
    {
        var result = _validator.TestValidate(ValidCommand() with { DateFormat = dateFormat });
        result.ShouldHaveValidationErrorFor(x => x.DateFormat);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(2)]
    public void ValidTemperatureDecimalsShouldPass(int decimals)
    {
        var result = _validator.TestValidate(ValidCommand() with { TemperatureDecimals = decimals });
        result.ShouldNotHaveValidationErrorFor(x => x.TemperatureDecimals);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(3)]
    [InlineData(99)]
    public void InvalidTemperatureDecimalsShouldFail(int decimals)
    {
        var result = _validator.TestValidate(ValidCommand() with { TemperatureDecimals = decimals });
        result.ShouldHaveValidationErrorFor(x => x.TemperatureDecimals);
    }

    [Fact]
    public void AllValidValuesShouldProduceNoErrors()
    {
        var result = _validator.TestValidate(ValidCommand());
        result.IsValid.ShouldBeTrue();
    }

    private static UpdateUserPreferencesCommand ValidCommand() =>
        new("F", "mph", "inhg", "in", "mi", "system", "mdy", 1, "utc");
}
