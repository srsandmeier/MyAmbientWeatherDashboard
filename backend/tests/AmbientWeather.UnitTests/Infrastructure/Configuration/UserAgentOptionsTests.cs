using AmbientWeather.Infrastructure.Configuration;
using Microsoft.Extensions.Configuration;
using Shouldly;

namespace AmbientWeather.UnitTests.Infrastructure.Configuration;

public class UserAgentOptionsTests
{
    [Fact]
    public void FromConfigurationPreservesLegacyScalarValue()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["UserAgent"] = "LegacyDashboard/2.0 (ops@example.test)",
                ["UserAgent:ProductName"] = "IgnoredProduct",
            })
            .Build();

        var options = UserAgentOptions.FromConfiguration(config);

        options.ToHeaderValue().ShouldBe("LegacyDashboard/2.0 (ops@example.test)");
        options.HasProviderContact.ShouldBeTrue();
    }

    [Fact]
    public void FromConfigurationBuildsVersionAwareDefaultValue()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["AppSlug"] = "ConfiguredDashboard",
            })
            .Build();

        var options = UserAgentOptions.FromConfiguration(config);
        var headerValue = options.ToHeaderValue();

        headerValue.ShouldStartWith("ConfiguredDashboard/");
        headerValue.ShouldNotContain(" ");
    }

    [Fact]
    public void FromConfigurationAppendsContactWhenConfigured()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["UserAgent:ProductName"] = "Ambient Weather Dashboard",
                ["UserAgent:Version"] = "12.3.4+build.5",
                ["UserAgent:Contact"] = "ops@example.test",
            })
            .Build();

        var options = UserAgentOptions.FromConfiguration(config);

        options.ToHeaderValue().ShouldBe("Ambient-Weather-Dashboard/12.3.4+build.5 (ops@example.test)");
        options.HasProviderContact.ShouldBeTrue();
    }

    [Fact]
    public void FromConfigurationSanitizesGeneratedVersion()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["UserAgent:ProductName"] = "Ambient Weather Dashboard",
                ["UserAgent:Version"] = "1.2.3 beta",
            })
            .Build();

        var options = UserAgentOptions.FromConfiguration(config);

        options.ToHeaderValue().ShouldBe("Ambient-Weather-Dashboard/1.2.3-beta");
    }

    [Fact]
    public void HasProviderContactRequiresParenthesizedContact()
    {
        new UserAgentOptions { Value = "AmbientWeatherDashboard/1.0" }
            .HasProviderContact
            .ShouldBeFalse();

        new UserAgentOptions { Value = "AmbientWeatherDashboard/1.0 (ops@example.test)" }
            .HasProviderContact
            .ShouldBeTrue();
    }
}
