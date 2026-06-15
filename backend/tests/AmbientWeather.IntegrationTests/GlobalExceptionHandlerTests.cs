using System.Net;
using System.Net.Http.Json;
using AmbientWeather.Application.DTOs.Common;
using Shouldly;
#pragma warning disable CA1515 // test class intentionally not internal — xUnit discovery requirement

namespace AmbientWeather.IntegrationTests;

public sealed class GlobalExceptionHandlerTests(TestApplicationFactory factory)
    : IClassFixture<TestApplicationFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task UnhandledExceptionReturnsSafeErrorResponse()
    {
        var response = await _client.GetAsync("/test/throw");

        response.StatusCode.ShouldBe(HttpStatusCode.InternalServerError);

        var error = await response.Content.ReadFromJsonAsync<ErrorResponseDto>();
        error.ShouldNotBeNull();
        error.Error.ShouldBe("internal-server-error");
        error.Message.ShouldNotContain("Test exception");
    }

    [Fact]
    public async Task CircuitOpenExceptionReturns503WithAmbientUnavailableError()
    {
        var response = await _client.GetAsync("/test/throw-circuit-open");

        response.StatusCode.ShouldBe(HttpStatusCode.ServiceUnavailable);

        var error = await response.Content.ReadFromJsonAsync<ErrorResponseDto>();
        error.ShouldNotBeNull();
        error.Error.ShouldBe("ambient-unavailable");
    }
}
