using AmbientWeather.Infrastructure.Ambient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Shouldly;

namespace AmbientWeather.UnitTests.Infrastructure.Ambient;

public class AmbientApiOptionsTests
{
    [Fact]
    public void DefaultValuesAreValid()
    {
        var options = new AmbientApiOptions();

        options.BaseUrl.ShouldBe("https://api.ambientweather.net/v1/");
        options.Resilience.MaxRetryAttempts.ShouldBe(3);
        options.Resilience.BaseRetryDelayMilliseconds.ShouldBe(500);
        options.Resilience.CircuitBreakerFailureThreshold.ShouldBe(5);
        options.Resilience.CircuitBreakerBreakDurationSeconds.ShouldBe(30);
        options.RateLimits.UserApiKeyIntervalMilliseconds.ShouldBe(1000);
        options.RateLimits.ApplicationKeyIntervalMilliseconds.ShouldBe(334);
    }

    [Fact]
    public void BindsFromConfigurationSection()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["AmbientApi:BaseUrl"] = "https://custom.example.com/v1/",
                ["AmbientApi:Resilience:MaxRetryAttempts"] = "2",
                ["AmbientApi:Resilience:BaseRetryDelayMilliseconds"] = "250",
                ["AmbientApi:Resilience:CircuitBreakerFailureThreshold"] = "3",
                ["AmbientApi:Resilience:CircuitBreakerBreakDurationSeconds"] = "60",
                ["AmbientApi:RateLimits:UserApiKeyIntervalMilliseconds"] = "2000",
                ["AmbientApi:RateLimits:ApplicationKeyIntervalMilliseconds"] = "500",
            })
            .Build();

        var options = new AmbientApiOptions();
        config.GetSection(AmbientApiOptions.SectionName).Bind(options);

        options.BaseUrl.ShouldBe("https://custom.example.com/v1/");
        options.Resilience.MaxRetryAttempts.ShouldBe(2);
        options.Resilience.BaseRetryDelayMilliseconds.ShouldBe(250);
        options.Resilience.CircuitBreakerFailureThreshold.ShouldBe(3);
        options.Resilience.CircuitBreakerBreakDurationSeconds.ShouldBe(60);
        options.RateLimits.UserApiKeyIntervalMilliseconds.ShouldBe(2000);
        options.RateLimits.ApplicationKeyIntervalMilliseconds.ShouldBe(500);
    }

    [Fact]
    public void ValidationPassesWithDefaults()
    {
        var validator = new DataAnnotationValidateOptions<AmbientApiOptions>(Options.DefaultName);
        var result = validator.Validate(Options.DefaultName, new AmbientApiOptions());

        result.Succeeded.ShouldBeTrue();
    }

    [Fact]
    public void ValidationFailsForInvalidBaseUrl()
    {
        var validator = new DataAnnotationValidateOptions<AmbientApiOptions>(Options.DefaultName);
        var options = new AmbientApiOptions { BaseUrl = "not-a-url" };

        var result = validator.Validate(Options.DefaultName, options);

        result.Failed.ShouldBeTrue();
    }
}
