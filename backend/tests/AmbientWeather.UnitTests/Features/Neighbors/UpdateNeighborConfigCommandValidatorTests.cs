using AmbientWeather.Application.Features.Neighbors.Commands;
using AmbientWeather.Domain.Neighbors;
using FluentValidation.TestHelper;
using Xunit;

namespace AmbientWeather.UnitTests.Features.Neighbors;

public sealed class UpdateNeighborConfigCommandValidatorTests
{
    private readonly UpdateNeighborConfigCommandValidator _validator = new();

    private static UpdateNeighborConfigCommand ValidCommand() =>
        new(IsEnabled: false, EnabledStationMacAddresses: null, RadiusMiles: 25, ComparisonRadiusMiles: 25,
            MaxAgeMinutes: 30, MinStations: 3, EnabledProviders: ["WeatherGov", "OpenMeteo"], RefreshIntervalMinutes: 15);

    [Fact]
    public void ValidCommandShouldPass()
    {
        var result = _validator.TestValidate(ValidCommand());
        result.ShouldNotHaveAnyValidationErrors();
    }

    // -----------------------------------------------------------------------
    // RadiusMiles
    // -----------------------------------------------------------------------

    [Theory]
    [InlineData(5)]
    [InlineData(25)]
    [InlineData(50)]
    public void ValidRadiusShouldPass(double radius)
    {
        var result = _validator.TestValidate(ValidCommand() with { RadiusMiles = radius });
        result.ShouldNotHaveValidationErrorFor(x => x.RadiusMiles);
    }

    [Theory]
    [InlineData(4)]
    [InlineData(51)]
    [InlineData(0)]
    public void InvalidRadiusShouldFail(double radius)
    {
        var result = _validator.TestValidate(ValidCommand() with { RadiusMiles = radius });
        result.ShouldHaveValidationErrorFor(x => x.RadiusMiles);
    }

    [Theory]
    [InlineData(0.5)]
    [InlineData(12.5)]
    [InlineData(34)]
    public void ValidComparisonRadiusShouldPass(double radius)
    {
        var result = _validator.TestValidate(ValidCommand() with { ComparisonRadiusMiles = radius });
        result.ShouldNotHaveValidationErrorFor(x => x.ComparisonRadiusMiles);
    }

    [Theory]
    [InlineData(0.4)]
    [InlineData(34.1)]
    public void InvalidComparisonRadiusShouldFail(double radius)
    {
        var result = _validator.TestValidate(ValidCommand() with { ComparisonRadiusMiles = radius });
        result.ShouldHaveValidationErrorFor(x => x.ComparisonRadiusMiles);
    }

    // -----------------------------------------------------------------------
    // MaxAgeMinutes
    // -----------------------------------------------------------------------

    [Theory]
    [InlineData(5)]
    [InlineData(30)]
    [InlineData(120)]
    public void ValidMaxAgeShouldPass(int maxAge)
    {
        var result = _validator.TestValidate(ValidCommand() with { MaxAgeMinutes = maxAge });
        result.ShouldNotHaveValidationErrorFor(x => x.MaxAgeMinutes);
    }

    [Theory]
    [InlineData(4)]
    [InlineData(121)]
    public void InvalidMaxAgeShouldFail(int maxAge)
    {
        var result = _validator.TestValidate(ValidCommand() with { MaxAgeMinutes = maxAge });
        result.ShouldHaveValidationErrorFor(x => x.MaxAgeMinutes);
    }

    // -----------------------------------------------------------------------
    // MinStations
    // -----------------------------------------------------------------------

    [Theory]
    [InlineData(1)]
    [InlineData(3)]
    [InlineData(20)]
    public void ValidMinStationsShouldPass(int min)
    {
        var result = _validator.TestValidate(ValidCommand() with { MinStations = min });
        result.ShouldNotHaveValidationErrorFor(x => x.MinStations);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(51)]
    public void InvalidMinStationsShouldFail(int min)
    {
        var result = _validator.TestValidate(ValidCommand() with { MinStations = min });
        result.ShouldHaveValidationErrorFor(x => x.MinStations);
    }

    // -----------------------------------------------------------------------
    // RefreshIntervalMinutes
    // -----------------------------------------------------------------------

    [Theory]
    [InlineData(5)]
    [InlineData(15)]
    [InlineData(60)]
    public void ValidRefreshIntervalShouldPass(int interval)
    {
        var result = _validator.TestValidate(ValidCommand() with { RefreshIntervalMinutes = interval });
        result.ShouldNotHaveValidationErrorFor(x => x.RefreshIntervalMinutes);
    }

    [Theory]
    [InlineData(4)]
    [InlineData(61)]
    public void InvalidRefreshIntervalShouldFail(int interval)
    {
        var result = _validator.TestValidate(ValidCommand() with { RefreshIntervalMinutes = interval });
        result.ShouldHaveValidationErrorFor(x => x.RefreshIntervalMinutes);
    }

    [Fact]
    public void LongDiscoveryLocationQueryShouldFail()
    {
        var result = _validator.TestValidate(ValidCommand() with
        {
            DiscoveryLocationQuery = new string('x', 129),
        });

        result.ShouldHaveValidationErrorFor(x => x.DiscoveryLocationQuery);
    }

    // -----------------------------------------------------------------------
    // EnabledProviders
    // -----------------------------------------------------------------------

    [Theory]
    [InlineData("AmbientOpen")]
    [InlineData("WeatherGov")]
    [InlineData("OpenMeteo")]
    public void KnownProviderShouldPass(string provider)
    {
        var result = _validator.TestValidate(ValidCommand() with { EnabledProviders = [provider] });
        result.ShouldNotHaveValidationErrorFor(x => x.EnabledProviders);
    }

    [Theory]
    [InlineData("unknown")]
    [InlineData("nws")]
    [InlineData("")]
    public void UnknownProviderShouldFail(string provider)
    {
        var result = _validator.TestValidate(ValidCommand() with { EnabledProviders = [provider] });
        result.ShouldHaveValidationErrorFor($"{nameof(UpdateNeighborConfigCommand.EnabledProviders)}[0]");
    }

    [Fact]
    public void TooManyEnabledStationMacAddressesShouldFail()
    {
        var macs = Enumerable
            .Range(1, 51)
            .Select(i => $"generated-mac-{i}")
            .ToArray();

        var result = _validator.TestValidate(ValidCommand() with { EnabledStationMacAddresses = macs });

        result.ShouldHaveValidationErrorFor(x => x.EnabledStationMacAddresses);
    }

    // -----------------------------------------------------------------------
    // PinnedStations
    // -----------------------------------------------------------------------

    [Fact]
    public void ValidPinnedStationShouldPass()
    {
        var result = _validator.TestValidate(ValidCommand() with
        {
            PinnedStations = [new PinnedNeighborStation("WeatherGov", "generated-source", "Generated label")],
        });

        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void TooManyPinnedStationsShouldFail()
    {
        var pins = Enumerable
            .Range(1, 11)
            .Select(i => new PinnedNeighborStation("WeatherGov", $"generated-source-{i}", null))
            .ToArray();

        var result = _validator.TestValidate(ValidCommand() with { PinnedStations = pins });

        result.ShouldHaveValidationErrorFor(x => x.PinnedStations);
    }

    [Theory]
    [InlineData("")]
    [InlineData("Unknown")]
    public void InvalidPinnedStationProviderShouldFail(string provider)
    {
        var result = _validator.TestValidate(ValidCommand() with
        {
            PinnedStations = [new PinnedNeighborStation(provider, "generated-source", null)],
        });

        result.ShouldHaveValidationErrorFor($"{nameof(UpdateNeighborConfigCommand.PinnedStations)}[0].Provider");
    }

    [Theory]
    [InlineData("")]
    [InlineData("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")]
    public void InvalidPinnedStationSourceIdShouldFail(string sourceId)
    {
        var result = _validator.TestValidate(ValidCommand() with
        {
            PinnedStations = [new PinnedNeighborStation("WeatherGov", sourceId, null)],
        });

        result.ShouldHaveValidationErrorFor($"{nameof(UpdateNeighborConfigCommand.PinnedStations)}[0].SourceId");
    }

    [Fact]
    public void LongPinnedStationDisplayLabelShouldFail()
    {
        var result = _validator.TestValidate(ValidCommand() with
        {
            PinnedStations =
            [
                new PinnedNeighborStation(
                    "WeatherGov",
                    "generated-source",
                    new string('x', 129)),
            ],
        });

        result.ShouldHaveValidationErrorFor($"{nameof(UpdateNeighborConfigCommand.PinnedStations)}[0].DisplayLabel");
    }
}
