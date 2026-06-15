using AmbientWeather.Application.Features.Settings.Commands;
using FluentValidation.TestHelper;

namespace AmbientWeather.UnitTests.Features.Settings;

public sealed class SaveAmbientCredentialsCommandValidatorTests
{
    private readonly SaveAmbientCredentialsCommandValidator _validator = new();

    [Fact]
    public void ValidCommandShouldPassValidation()
    {
        var result = _validator.TestValidate(new SaveAmbientCredentialsCommand("api-key", "application-key"));

        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    public void EmptyApiKeyShouldFailValidation(string apiKey)
    {
        var result = _validator.TestValidate(new SaveAmbientCredentialsCommand(apiKey, "application-key"));

        result.ShouldHaveValidationErrorFor(command => command.ApiKey);
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    public void EmptyApplicationKeyShouldFailValidation(string applicationKey)
    {
        var result = _validator.TestValidate(new SaveAmbientCredentialsCommand("api-key", applicationKey));

        result.ShouldHaveValidationErrorFor(command => command.ApplicationKey);
    }
}
