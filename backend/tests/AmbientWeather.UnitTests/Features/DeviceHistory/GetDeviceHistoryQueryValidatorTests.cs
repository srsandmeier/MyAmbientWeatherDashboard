using AmbientWeather.Application.Features.DeviceHistory.Queries;
using FluentValidation.TestHelper;

namespace AmbientWeather.UnitTests.Features.DeviceHistory;

public class GetDeviceHistoryQueryValidatorTests
{
    private readonly GetDeviceHistoryQueryValidator _validator = new();
    private const string ValidMac = "AA:BB:CC:DD:EE:FF";

    [Theory]
    [InlineData("AA:BB:CC:DD:EE:FF", 288)]
    [InlineData("00:11:22:33:44:55", 1)]
    [InlineData("AABBCCDDEEFF", 100)]
    public void ValidQueryShouldPassValidation(string mac, int limit)
    {
        var result = _validator.TestValidate(new GetDeviceHistoryQuery(mac, limit, null));
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("not-a-mac")]
    [InlineData("00:11:22")]
    [InlineData("ZZ:ZZ:ZZ:ZZ:ZZ:ZZ")]
    [InlineData("")]
    public void InvalidMacAddressShouldFailValidation(string mac)
    {
        var result = _validator.TestValidate(new GetDeviceHistoryQuery(mac, 288, null));
        result.ShouldHaveValidationErrorFor(q => q.MacAddress);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(289)]
    [InlineData(1000)]
    public void LimitOutOfRangeShouldFailValidation(int limit)
    {
        var result = _validator.TestValidate(new GetDeviceHistoryQuery(ValidMac, limit, null));
        result.ShouldHaveValidationErrorFor(q => q.Limit);
    }

    [Fact]
    public void FutureEndDateShouldFailValidation()
    {
        var future = DateTime.UtcNow.AddDays(1);
        var result = _validator.TestValidate(new GetDeviceHistoryQuery(ValidMac, 288, future));
        result.ShouldHaveValidationErrorFor(q => q.EndDate);
    }

    [Fact]
    public void TodayEndDateShouldPassValidation()
    {
        var today = DateTime.UtcNow.Date;
        var result = _validator.TestValidate(new GetDeviceHistoryQuery(ValidMac, 288, today));
        result.ShouldNotHaveAnyValidationErrors();
    }
}
