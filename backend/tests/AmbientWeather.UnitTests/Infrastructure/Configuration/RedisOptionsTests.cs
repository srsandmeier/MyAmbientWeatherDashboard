using AmbientWeather.Infrastructure.Configuration;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Shouldly;

namespace AmbientWeather.UnitTests.Infrastructure.Configuration;

public class RedisOptionsTests
{
    [Fact]
    public void DefaultsAreDevelopmentFriendly()
    {
        var options = new RedisOptions();

        options.ConnectionString.ShouldBeNull();
        options.InstanceName.ShouldBe("AmbientWeatherDashboard:");
        options.IsConfigured.ShouldBeFalse();
    }

    [Fact]
    public void FromConfigurationPrefersConnectionStringsRedis()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["ConnectionStrings:Redis"] = "localhost:6379",
                ["Redis:ConnectionString"] = "ignored:6379",
                ["Redis:InstanceName"] = "Custom:",
            })
            .Build();

        var options = RedisOptions.FromConfiguration(config);

        options.ConnectionString.ShouldBe("localhost:6379");
        options.InstanceName.ShouldBe("Custom:");
        options.IsConfigured.ShouldBeTrue();
    }

    [Fact]
    public void FromConfigurationFallsBackToRedisSectionConnectionString()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["Redis:ConnectionString"] = "redis.example:6379",
            })
            .Build();

        var options = RedisOptions.FromConfiguration(config);

        options.ConnectionString.ShouldBe("redis.example:6379");
        options.IsConfigured.ShouldBeTrue();
    }

    [Fact]
    public void ValidationFailsForBlankInstanceName()
    {
        var validator = new DataAnnotationValidateOptions<RedisOptions>(Options.DefaultName);
        var result = validator.Validate(Options.DefaultName, new RedisOptions { InstanceName = string.Empty });

        result.Failed.ShouldBeTrue();
    }
}
