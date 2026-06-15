using AmbientWeather.Api.Configuration;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Shouldly;

namespace AmbientWeather.UnitTests.Api.Configuration;

public class ApplicationAuthenticationOptionsTests
{
    [Fact]
    public void IsConfiguredRequiresAuthorityAndAudience()
    {
        new ApplicationAuthenticationOptions().IsConfigured.ShouldBeFalse();
        new ApplicationAuthenticationOptions { Authority = "https://auth.example.com/" }.IsConfigured.ShouldBeFalse();
        new ApplicationAuthenticationOptions { Audience = "api" }.IsConfigured.ShouldBeFalse();
        new ApplicationAuthenticationOptions
        {
            Authority = "https://auth.example.com/",
            Audience = "api",
        }.IsConfigured.ShouldBeTrue();
    }

    [Fact]
    public void FromConfigurationBindsPreferredAuthenticationSection()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["Authentication:Authority"] = "https://auth.example.com/",
                ["Authentication:Audience"] = "ambient-api",
                ["Auth0:Authority"] = "https://legacy.example.com/",
                ["Auth0:Audience"] = "legacy-api",
            })
            .Build();

        var options = ApplicationAuthenticationOptions.FromConfiguration(config);

        options.Authority.ShouldBe("https://auth.example.com/");
        options.Audience.ShouldBe("ambient-api");
        options.IsConfigured.ShouldBeTrue();
    }

    [Fact]
    public void FromConfigurationFallsBackToLegacyAuth0Section()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["Auth0:Authority"] = "https://legacy.example.com/",
                ["Auth0:Audience"] = "legacy-api",
            })
            .Build();

        var options = ApplicationAuthenticationOptions.FromConfiguration(config);

        options.Authority.ShouldBe("https://legacy.example.com/");
        options.Audience.ShouldBe("legacy-api");
        options.IsConfigured.ShouldBeTrue();
    }

    [Fact]
    public void ValidationFailsForInvalidAuthorityUrl()
    {
        var validator = new DataAnnotationValidateOptions<ApplicationAuthenticationOptions>(Options.DefaultName);
        var options = new ApplicationAuthenticationOptions { Authority = "not-a-url", Audience = "api" };

        var result = validator.Validate(Options.DefaultName, options);

        result.Failed.ShouldBeTrue();
    }
}
