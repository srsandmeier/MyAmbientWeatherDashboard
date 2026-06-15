using AmbientWeather.Application.Common;
using Shouldly;

namespace AmbientWeather.UnitTests.Application.Common;

public sealed class MacAddressValidatorTests
{
    [Theory]
    [InlineData("AA:BB:CC:DD:EE:FF")]
    [InlineData("AA-BB-CC-DD-EE-FF")]
    [InlineData("AABBCCDDEEFF")]
    public void IsValidReturnsTrueForSupportedFormats(string macAddress)
    {
        MacAddressValidator.IsValid(macAddress).ShouldBeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-a-mac")]
    [InlineData("AA:BB:CC")]
    [InlineData("GG:BB:CC:DD:EE:FF")]
    public void IsValidReturnsFalseForUnsupportedFormats(string macAddress)
    {
        MacAddressValidator.IsValid(macAddress).ShouldBeFalse();
    }

    [Fact]
    public void NormalizeReturnsUppercaseHexWithoutSeparators()
    {
        var result = MacAddressValidator.Normalize("aa-bb-cc-dd-ee-ff");

        result.ShouldBe("AABBCCDDEEFF");
    }

    [Fact]
    public void EqualsNormalizedReturnsTrueForEquivalentFormats()
    {
        MacAddressValidator.EqualsNormalized("aa:bb:cc:dd:ee:ff", "AABBCCDDEEFF").ShouldBeTrue();
    }

    [Fact]
    public void ToColonSeparatedReturnsProviderPathFormat()
    {
        var result = MacAddressValidator.ToColonSeparated("aa-bb-cc-dd-ee-ff");

        result.ShouldBe("AA:BB:CC:DD:EE:FF");
    }
}
