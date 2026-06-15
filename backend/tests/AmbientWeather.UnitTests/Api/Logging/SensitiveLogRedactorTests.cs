using AmbientWeather.Api.Logging;
using Shouldly;

namespace AmbientWeather.UnitTests.Api.Logging;

/// <summary>Unit tests for <see cref="SensitiveLogRedactor"/>.</summary>
public sealed class SensitiveLogRedactorTests
{
    [Theory]
    [InlineData("apiKey")]
    [InlineData("apikey")]
    [InlineData("APIKEY")]
    [InlineData("applicationKey")]
    [InlineData("ApplicationKey")]
    [InlineData("password")]
    [InlineData("secret")]
    [InlineData("token")]
    [InlineData("authorization")]
    [InlineData("Authorization")]
    [InlineData("cookie")]
    [InlineData("set-cookie")]
    [InlineData("x-api-key")]
    [InlineData("x-application-key")]
    public void IsSensitiveKeyReturnsTrueForKnownSecretKeys(string key) =>
        SensitiveLogRedactor.IsSensitiveKey(key).ShouldBeTrue();

    [Theory]
    [InlineData("stationId")]
    [InlineData("macAddress")]
    [InlineData("username")]
    [InlineData("email")]
    [InlineData("userId")]
    [InlineData("latitude")]
    [InlineData("")]
    public void IsSensitiveKeyReturnsFalseForNonSensitiveKeys(string key) =>
        SensitiveLogRedactor.IsSensitiveKey(key).ShouldBeFalse();

    [Fact]
    public void IsSensitiveKeyReturnsFalseForNullKey() =>
        SensitiveLogRedactor.IsSensitiveKey(null!).ShouldBeFalse();

    [Theory]
    [InlineData("apiKey", "secret-value")]
    [InlineData("applicationKey", "app-key-123")]
    [InlineData("password", "hunter2")]
    public void RedactIfSensitiveReplacesValueWithPlaceholderForSensitiveKey(string key, string value)
    {
        var result = SensitiveLogRedactor.RedactIfSensitive(key, value);
        result.ShouldBe(SensitiveLogRedactor.RedactedPlaceholder);
        result.ShouldNotContain(value);
    }

    [Theory]
    [InlineData("stationId", "mac-abc-123")]
    [InlineData("latitude", "47.6")]
    [InlineData("userId", "user-guid")]
    public void RedactIfSensitiveReturnsOriginalValueForNonSensitiveKey(string key, string value) =>
        SensitiveLogRedactor.RedactIfSensitive(key, value).ShouldBe(value);

    [Fact]
    public void RedactedPlaceholderIsNonEmpty() =>
        SensitiveLogRedactor.RedactedPlaceholder.ShouldNotBeNullOrWhiteSpace();
}
