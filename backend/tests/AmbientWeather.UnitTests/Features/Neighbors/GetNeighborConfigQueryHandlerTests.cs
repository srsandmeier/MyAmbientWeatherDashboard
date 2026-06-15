using AmbientWeather.Application.Common;
using AmbientWeather.Application.Features.Neighbors.Queries;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using Moq;
using Shouldly;
using Xunit;

namespace AmbientWeather.UnitTests.Features.Neighbors;

public sealed class GetNeighborConfigQueryHandlerTests
{
    private const string Subject = "auth0|test-user";

    private readonly Mock<ICurrentUserService> _currentUserMock = new();
    private readonly Mock<IUserPreferencesStore> _prefStoreMock = new();

    private GetNeighborConfigQueryHandler CreateHandler() =>
        new(_prefStoreMock.Object, _currentUserMock.Object);

    private void SetupAuthenticatedUser()
    {
        _currentUserMock.SetupGet(s => s.IsAuthenticated).Returns(true);
        _currentUserMock.SetupGet(s => s.AuthProviderSubject).Returns(Subject);
        _currentUserMock.SetupGet(s => s.Email).Returns("test@example.com");
    }

    private void SetupPreferences(string? neighborConfigJson = null)
    {
        _prefStoreMock
            .Setup(s => s.GetOrCreateAsync(Subject, It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserPreferences { NeighborConfigJson = neighborConfigJson! });
    }

    // -----------------------------------------------------------------------
    // Defaults when no config stored
    // -----------------------------------------------------------------------

    [Fact]
    public async Task NullConfigJsonShouldReturnDefaults()
    {
        SetupAuthenticatedUser();
        SetupPreferences(neighborConfigJson: null);

        var result = await CreateHandler().Handle(new GetNeighborConfigQuery(), CancellationToken.None);

        result.IsEnabled.ShouldBeFalse();
        result.RadiusMiles.ShouldBe(25);
        result.MaxAgeMinutes.ShouldBe(30);
        result.MinStations.ShouldBe(3);
        result.RefreshIntervalMinutes.ShouldBe(15);
        result.EnabledProviders.ShouldContain("WeatherGov");
        result.EnabledProviders.ShouldContain("OpenMeteo");
    }

    [Fact]
    public async Task EmptyObjectConfigJsonShouldReturnDefaults()
    {
        SetupAuthenticatedUser();
        SetupPreferences(neighborConfigJson: "{}");

        var result = await CreateHandler().Handle(new GetNeighborConfigQuery(), CancellationToken.None);

        result.RadiusMiles.ShouldBe(25);
    }

    // -----------------------------------------------------------------------
    // Stored config is returned
    // -----------------------------------------------------------------------

    [Fact]
    public async Task StoredConfigJsonShouldBeReturned()
    {
        SetupAuthenticatedUser();
        SetupPreferences(neighborConfigJson:
            """{"isEnabled":true,"radiusMiles":10,"maxAgeMinutes":15,"minStations":5,"enabledProviders":["WeatherGov"],"refreshIntervalMinutes":20}""");

        var result = await CreateHandler().Handle(new GetNeighborConfigQuery(), CancellationToken.None);

        result.IsEnabled.ShouldBeTrue();
        result.RadiusMiles.ShouldBe(10);
        result.MaxAgeMinutes.ShouldBe(15);
        result.MinStations.ShouldBe(5);
        result.RefreshIntervalMinutes.ShouldBe(20);
        result.EnabledProviders.ShouldBe(["WeatherGov"]);
    }

    // -----------------------------------------------------------------------
    // Malformed JSON falls back to defaults
    // -----------------------------------------------------------------------

    [Fact]
    public async Task MalformedConfigJsonShouldReturnDefaults()
    {
        SetupAuthenticatedUser();
        SetupPreferences(neighborConfigJson: "not valid json {{{");

        var result = await CreateHandler().Handle(new GetNeighborConfigQuery(), CancellationToken.None);

        result.RadiusMiles.ShouldBe(25);
    }
}
