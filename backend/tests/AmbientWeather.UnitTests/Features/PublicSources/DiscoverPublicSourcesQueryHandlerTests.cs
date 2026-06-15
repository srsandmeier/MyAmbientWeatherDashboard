using AmbientWeather.Application.DTOs.PublicSources;
using AmbientWeather.Application.Features.PublicSources.Queries;
using AmbientWeather.Application.Interfaces;
using Bogus;
using Moq;
using Shouldly;

namespace AmbientWeather.UnitTests.Features.PublicSources;

public sealed class DiscoverPublicSourcesQueryHandlerTests
{
    private static readonly Faker F = new();

    private readonly Mock<IPublicSourceDiscoveryService> _serviceMock = new();
    private readonly Mock<ICurrentUserService> _currentUserMock = new();

    public DiscoverPublicSourcesQueryHandlerTests()
    {
        _currentUserMock.Setup(s => s.IsAuthenticated).Returns(true);
        _currentUserMock.Setup(s => s.AuthProviderSubject).Returns("auth0|test-user");
    }

    private DiscoverPublicSourcesQueryHandler CreateHandler() =>
        new(_serviceMock.Object, _currentUserMock.Object);

    [Fact]
    public async Task HandleDelegatesToDiscoveryServiceAndReturnsResults()
    {
        const string SearchQuery = "Generated City, ST";
        var expected = new List<DiscoveredPublicSourceDto>
        {
            new()
            {
                Provider = "WeatherGov",
                SourceId = $"KGEN{F.Random.AlphaNumeric(3).ToUpperInvariant()}",
                DisplayLabel = $"Generated Station {F.Random.AlphaNumeric(4)}",
                Latitude = F.Address.Latitude(),
                Longitude = F.Address.Longitude(),
                Timezone = null,
            },
        };

        _serviceMock
            .Setup(s => s.DiscoverAsync(SearchQuery, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);

        var result = await CreateHandler().Handle(new DiscoverPublicSourcesQuery(SearchQuery), CancellationToken.None);

        result.Count.ShouldBe(1);
        result[0].Provider.ShouldBe("WeatherGov");
        result[0].SourceId.ShouldBe(expected[0].SourceId);
        result[0].DisplayLabel.ShouldBe(expected[0].DisplayLabel);
    }

    [Fact]
    public async Task HandleReturnsEmptyListWhenServiceReturnsNothing()
    {
        _serviceMock
            .Setup(s => s.DiscoverAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        var result = await CreateHandler().Handle(
            new DiscoverPublicSourcesQuery("Generated nowhere"),
            CancellationToken.None);

        result.ShouldBeEmpty();
    }

    [Fact]
    public async Task HandleForwardsExactQueryStringToService()
    {
        var query = $"Generated {F.Random.AlphaNumeric(8)}, ST";
        _serviceMock
            .Setup(s => s.DiscoverAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        await CreateHandler().Handle(new DiscoverPublicSourcesQuery(query), CancellationToken.None);

        _serviceMock.Verify(s => s.DiscoverAsync(query, It.IsAny<CancellationToken>()), Times.Once);
    }
}
