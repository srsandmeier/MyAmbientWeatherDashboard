using AmbientWeather.Application.Features.PublicSources;
using AmbientWeather.Application.Features.PublicSources.Commands;
using AmbientWeather.UnitTests.TestData;
using Bogus;
using FluentValidation.TestHelper;

namespace AmbientWeather.UnitTests.Features.PublicSources;

public sealed class PublicWeatherSourceCommandValidatorTests
{
    private static readonly Faker F = new();

    private readonly CreatePublicWeatherSourceCommandValidator _createValidator = new();
    private readonly UpdatePublicWeatherSourceCommandValidator _updateValidator = new();
    private readonly DeletePublicWeatherSourceCommandValidator _deleteValidator = new();

    [Theory]
    [InlineData(PublicWeatherSourceProviders.WeatherGov)]
    [InlineData(PublicWeatherSourceProviders.OpenMeteo)]
    public void CreateAllowsSupportedProviders(string provider)
    {
        var result = _createValidator.TestValidate(ValidCreate(provider: provider));
        result.ShouldNotHaveValidationErrorFor(x => x.Provider);
    }

    [Fact]
    public void CreateRejectsUnsupportedProvider()
    {
        var result = _createValidator.TestValidate(ValidCreate(provider: "Unsupported"));
        result.ShouldHaveValidationErrorFor(x => x.Provider);
    }

    [Fact]
    public void CreateRejectsOutOfRangeLatitude()
    {
        var result = _createValidator.TestValidate(ValidCreate(latitude: 91));
        result.ShouldHaveValidationErrorFor(x => x.Latitude);
    }

    [Fact]
    public void CreateRejectsOutOfRangeLongitude()
    {
        var result = _createValidator.TestValidate(ValidCreate(longitude: -181));
        result.ShouldHaveValidationErrorFor(x => x.Longitude);
    }

    [Fact]
    public void CreateRejectsBlankDisplayLabel()
    {
        var result = _createValidator.TestValidate(ValidCreate(displayLabel: string.Empty));
        result.ShouldHaveValidationErrorFor(x => x.DisplayLabel);
    }

    [Fact]
    public void CreateAllowsOptionalTimezone()
    {
        var result = _createValidator.TestValidate(ValidCreate(timezone: null));
        result.ShouldNotHaveValidationErrorFor(x => x.Timezone);
    }

    [Fact]
    public void CreateRejectsUnknownMetricKey()
    {
        var result = _createValidator.TestValidate(
            ValidCreate() with { SelectedMetricKeys = ["not_a_metric"] });
        result.ShouldHaveValidationErrorFor(x => x.SelectedMetricKeys);
    }

    [Fact]
    public void UpdateRejectsEmptyId()
    {
        var result = _updateValidator.TestValidate(new UpdatePublicWeatherSourceCommand(Guid.Empty, null, true));
        result.ShouldHaveValidationErrorFor(x => x.Id);
    }

    [Fact]
    public void UpdateAllowsPatchWithOnlyEnabledFlag()
    {
        var result = _updateValidator.TestValidate(new UpdatePublicWeatherSourceCommand(Guid.NewGuid(), null, false));
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void UpdateRejectsBlankDisplayLabelWhenProvided()
    {
        var result = _updateValidator.TestValidate(new UpdatePublicWeatherSourceCommand(Guid.NewGuid(), string.Empty, null));
        result.ShouldHaveValidationErrorFor(x => x.DisplayLabel);
    }

    [Fact]
    public void UpdateAllowsSupportedMetricKeys()
    {
        var result = _updateValidator.TestValidate(
            new UpdatePublicWeatherSourceCommand(Guid.NewGuid(), null, null, ["outdoor_temp", "wind_speed"]));
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void DeleteRejectsEmptyId()
    {
        var result = _deleteValidator.TestValidate(new DeletePublicWeatherSourceCommand(Guid.Empty));
        result.ShouldHaveValidationErrorFor(x => x.Id);
    }

    private static CreatePublicWeatherSourceCommand ValidCreate(
        string provider = PublicWeatherSourceProviders.WeatherGov,
        string? sourceId = null,
        string? displayLabel = null,
        double? latitude = null,
        double? longitude = null,
        string? timezone = "America/Chicago")
        => new(
            provider,
            sourceId ?? WeatherTestData.SourceId,
            displayLabel ?? $"Generated source {F.Random.AlphaNumeric(4)}",
            latitude ?? F.Address.Latitude(),
            longitude ?? F.Address.Longitude(),
            timezone,
            true);
}
