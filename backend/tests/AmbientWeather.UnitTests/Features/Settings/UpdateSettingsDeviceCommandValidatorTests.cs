using AmbientWeather.UnitTests.TestData;
using AmbientWeather.Application.Features.Settings.Commands;
using FluentValidation.TestHelper;

namespace AmbientWeather.UnitTests.Features.Settings;

public sealed class UpdateSettingsDeviceCommandValidatorTests
{
    private readonly UpdateSettingsDeviceCommandValidator _sut = new();

    private static UpdateSettingsDeviceCommand Valid(
        string? mac = null,
        string? nickname = null,
        bool? isPrimary = null,
        bool? display = null,
        IReadOnlyList<string>? keys = null)
        => new(mac ?? WeatherTestData.Mac, nickname, isPrimary, display, keys);

    [Fact]
    public void ValidCommandPassesValidation()
    {
        var result = _sut.TestValidate(Valid());
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    public void EmptyMacAddressFailsValidation(string? mac)
    {
        var result = _sut.TestValidate(new UpdateSettingsDeviceCommand(mac!, null, null, null, null));
        result.ShouldHaveValidationErrorFor(x => x.MacAddress);
    }

    [Fact]
    public void InvalidMacAddressFormatFailsValidation()
    {
        var result = _sut.TestValidate(Valid("not-a-mac"));
        result.ShouldHaveValidationErrorFor(x => x.MacAddress);
    }

    [Theory]
    [InlineData("AA:BB:CC:DD:EE:FF")]
    [InlineData("AA-BB-CC-DD-EE-FF")]
    [InlineData("AABBCCDDEEFF")]
    public void ValidMacAddressFormatsPassValidation(string mac)
    {
        var result = _sut.TestValidate(Valid(mac));
        result.ShouldNotHaveValidationErrorFor(x => x.MacAddress);
    }

    [Fact]
    public void NicknameLongerThan128CharactersFailsValidation()
    {
        var result = _sut.TestValidate(Valid(nickname: new string('x', 129)));
        result.ShouldHaveValidationErrorFor(x => x.Nickname);
    }

    [Fact]
    public void NicknameExactly128CharactersPassesValidation()
    {
        var result = _sut.TestValidate(Valid(nickname: new string('x', 128)));
        result.ShouldNotHaveValidationErrorFor(x => x.Nickname);
    }

    [Fact]
    public void NullNicknamePassesValidation()
    {
        var result = _sut.TestValidate(Valid(nickname: null));
        result.ShouldNotHaveValidationErrorFor(x => x.Nickname);
    }

    [Fact]
    public void MoreThan50MetricKeysFailsValidation()
    {
        var keys = Enumerable.Range(1, 51).Select(_ => "outdoor_temp").ToList();
        var result = _sut.TestValidate(Valid(keys: keys));
        result.ShouldHaveValidationErrorFor(x => x.SelectedMetricKeys);
    }

    [Fact]
    public void Exactly50MetricKeysPassesValidation()
    {
        var keys = Enumerable.Repeat("outdoor_temp", 50).ToList();
        var result = _sut.TestValidate(Valid(keys: keys));
        result.ShouldNotHaveValidationErrorFor(x => x.SelectedMetricKeys);
    }

    [Fact]
    public void UnrecognisedMetricKeyFailsValidation()
    {
        var result = _sut.TestValidate(Valid(keys: ["not_a_valid_key"]));
        result.ShouldHaveValidationErrorFor(x => x.SelectedMetricKeys);
    }

    [Theory]
    [InlineData("outdoor_temp")]
    [InlineData("feels_like")]
    [InlineData("dew_point")]
    [InlineData("daily_high_temp")]
    [InlineData("daily_low_temp")]
    [InlineData("indoor_temp")]
    [InlineData("indoor_feels_like")]
    [InlineData("indoor_dew_point")]
    [InlineData("daily_high_temp_in")]
    [InlineData("daily_low_temp_in")]
    [InlineData("outdoor_humidity")]
    [InlineData("indoor_humidity")]
    [InlineData("pressure")]
    [InlineData("uv_index")]
    [InlineData("solar_radiation")]
    [InlineData("wind_dir")]
    [InlineData("wind_speed")]
    [InlineData("wind_gust")]
    [InlineData("max_daily_gust")]
    [InlineData("rainfall_event")]
    [InlineData("rainfall_day")]
    [InlineData("rainfall_week")]
    [InlineData("rainfall_month")]
    [InlineData("rainfall_year")]
    public void EachAllowedMetricKeyPassesValidation(string key)
    {
        var result = _sut.TestValidate(Valid(keys: [key]));
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void NullSelectedMetricKeysPassesValidation()
    {
        var result = _sut.TestValidate(Valid(keys: null));
        result.ShouldNotHaveValidationErrorFor(x => x.SelectedMetricKeys);
    }

    [Fact]
    public void MetricKeyExceeding64CharactersFailsValidation()
    {
        var result = _sut.TestValidate(Valid(keys: [new string('x', 65)]));
        result.ShouldHaveValidationErrorFor(x => x.SelectedMetricKeys);
    }
}
