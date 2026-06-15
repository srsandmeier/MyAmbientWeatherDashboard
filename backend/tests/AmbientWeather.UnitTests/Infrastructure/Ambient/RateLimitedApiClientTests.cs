using System.Diagnostics;
using System.Net;
using System.Text;
using AmbientWeather.Application.Common;
using AmbientWeather.Infrastructure.Ambient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Shouldly;

namespace AmbientWeather.UnitTests.Infrastructure.Ambient;

public class RateLimitedApiClientTests
{
    [Fact]
    public async Task AmbientRateLimitStateRemovesIdleBuckets()
    {
        var state = new AmbientRateLimitState(TimeSpan.FromMilliseconds(1), cleanupScanInterval: 1);

        await state.WaitAsync("api-key:first", TimeSpan.Zero);
        state.BucketCount.ShouldBe(1);

        await Task.Delay(20);
        await state.WaitAsync("api-key:second", TimeSpan.Zero);

        state.BucketCount.ShouldBe(1);
    }

    [Fact]
    public async Task GetFromJsonAsyncWaitsBetweenRequestsForSameApiKey()
    {
        var handler = new CapturingHttpMessageHandler(_ => JsonResponse("[]"));
        var client = CreateClient(
            handler,
            new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["AmbientApi:RateLimits:UserApiKeyIntervalMilliseconds"] = "100",
                ["AmbientApi:RateLimits:ApplicationKeyIntervalMilliseconds"] = "0",
            });

        var stopwatch = Stopwatch.StartNew();

        await client.GetFromJsonAsync<List<object>>("devices", "same-key", "app-key");
        await client.GetFromJsonAsync<List<object>>("devices", "same-key", "app-key");

        stopwatch.Stop();
        stopwatch.ElapsedMilliseconds.ShouldBeGreaterThanOrEqualTo(75);
        handler.Requests.Count.ShouldBe(2);
    }

    [Fact]
    public async Task GetFromJsonAsyncRetriesTransientServerErrors()
    {
        var responses = new Queue<HttpResponseMessage>([
            new HttpResponseMessage(HttpStatusCode.InternalServerError),
            JsonResponse("[]"),
        ]);
        var handler = new CapturingHttpMessageHandler(_ => responses.Dequeue());
        var client = CreateClient(
            handler,
            new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["AmbientApi:Resilience:MaxRetryAttempts"] = "1",
                ["AmbientApi:Resilience:BaseRetryDelayMilliseconds"] = "1",
            });

        var result = await client.GetFromJsonAsync<List<object>>("devices", "key", "app");

        result.ShouldBeEmpty();
        handler.Requests.Count.ShouldBe(2);
    }

    [Fact]
    public async Task GetFromJsonAsyncRateLimitsRetryAttempts()
    {
        var responses = new Queue<HttpResponseMessage>([
            new HttpResponseMessage(HttpStatusCode.InternalServerError),
            JsonResponse("[]"),
        ]);
        var handler = new CapturingHttpMessageHandler(_ => responses.Dequeue());
        var client = CreateClient(
            handler,
            new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["AmbientApi:RateLimits:UserApiKeyIntervalMilliseconds"] = "100",
                ["AmbientApi:RateLimits:ApplicationKeyIntervalMilliseconds"] = "0",
                ["AmbientApi:Resilience:MaxRetryAttempts"] = "1",
                ["AmbientApi:Resilience:BaseRetryDelayMilliseconds"] = "1",
            });

        var stopwatch = Stopwatch.StartNew();

        var result = await client.GetFromJsonAsync<List<object>>("devices", "same-key", "app");

        stopwatch.Stop();
        result.ShouldBeEmpty();
        handler.Requests.Count.ShouldBe(2);
        stopwatch.ElapsedMilliseconds.ShouldBeGreaterThanOrEqualTo(75);
    }

    [Fact]
    public void CalculateRetryDelayUsesExponentialBackoffPlusJitter()
    {
        var delay = RateLimitedApiClient.CalculateRetryDelay(
            attempt: 3,
            baseRetryDelay: TimeSpan.FromMilliseconds(100),
            retryAfter: null,
            jitterMilliseconds: 25);

        delay.ShouldBe(TimeSpan.FromMilliseconds(425));
    }

    [Fact]
    public void CalculateRetryDelayHonorsLongerRetryAfterPlusJitter()
    {
        var delay = RateLimitedApiClient.CalculateRetryDelay(
            attempt: 2,
            baseRetryDelay: TimeSpan.FromMilliseconds(100),
            retryAfter: TimeSpan.FromMilliseconds(750),
            jitterMilliseconds: 50);

        delay.ShouldBe(TimeSpan.FromMilliseconds(800));
    }

    [Fact]
    public async Task GetFromJsonAsyncDoesNotRetryAuthorizationFailures()
    {
        var handler = new CapturingHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.Unauthorized));
        var client = CreateClient(
            handler,
            new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["AmbientApi:Resilience:MaxRetryAttempts"] = "2",
            });

        await Should.ThrowAsync<AmbientApiAuthException>(
            () => client.GetFromJsonAsync<List<object>>("devices", "key", "app"));

        handler.Requests.Count.ShouldBe(1);
    }

    [Fact]
    public async Task GetFromJsonAsyncOpensCircuitAfterFailureThreshold()
    {
        var handler = new CapturingHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));
        var client = CreateClient(
            handler,
            new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["AmbientApi:Resilience:MaxRetryAttempts"] = "0",
                ["AmbientApi:Resilience:CircuitBreakerFailureThreshold"] = "1",
                ["AmbientApi:Resilience:CircuitBreakerBreakDurationSeconds"] = "30",
            });

        await Should.ThrowAsync<HttpRequestException>(
            () => client.GetFromJsonAsync<List<object>>("devices", "key", "app"));

        await Should.ThrowAsync<AmbientCircuitOpenException>(
            () => client.GetFromJsonAsync<List<object>>("devices", "key", "app"));

        handler.Requests.Count.ShouldBe(1);
    }

    [Fact]
    public async Task GetFromJsonAsyncDoesNotDoubleCountFinalTransientHttpFailure()
    {
        var responses = new Queue<HttpResponseMessage>([
            new HttpResponseMessage(HttpStatusCode.ServiceUnavailable),
            JsonResponse("[]"),
        ]);
        var handler = new CapturingHttpMessageHandler(_ => responses.Dequeue());
        var client = CreateClient(
            handler,
            new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["AmbientApi:Resilience:MaxRetryAttempts"] = "0",
                ["AmbientApi:Resilience:CircuitBreakerFailureThreshold"] = "2",
                ["AmbientApi:Resilience:CircuitBreakerBreakDurationSeconds"] = "30",
            });

        await Should.ThrowAsync<HttpRequestException>(
            () => client.GetFromJsonAsync<List<object>>("devices", "key", "app"));

        var result = await client.GetFromJsonAsync<List<object>>("devices", "key", "app");

        result.ShouldBeEmpty();
        handler.Requests.Count.ShouldBe(2);
    }

    // --- New exception-mapping tests ---

    [Theory]
    [InlineData(HttpStatusCode.Unauthorized)]
    [InlineData(HttpStatusCode.Forbidden)]
    public async Task GetFromJsonAsyncMapsAuthStatusToAmbientApiAuthException(HttpStatusCode statusCode)
    {
        var handler = new CapturingHttpMessageHandler(_ => new HttpResponseMessage(statusCode));
        var client = CreateClient(handler);

        var ex = await Should.ThrowAsync<AmbientApiAuthException>(
            () => client.GetFromJsonAsync<List<object>>("devices", "key", "app"));

        ex.ShouldNotBeNull();
        handler.Requests.Count.ShouldBe(1);
    }

    [Fact]
    public async Task GetFromJsonAsyncMaps404ToAmbientApiNotFoundException()
    {
        var handler = new CapturingHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.NotFound));
        var client = CreateClient(handler);

        var ex = await Should.ThrowAsync<AmbientApiNotFoundException>(
            () => client.GetFromJsonAsync<List<object>>("devices", "key", "app"));

        ex.ShouldNotBeNull();
        handler.Requests.Count.ShouldBe(1);
    }

    [Fact]
    public async Task GetFromJsonAsyncMapsFinal429ToAmbientApiRateLimitException()
    {
        var handler = new CapturingHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.TooManyRequests));
        var client = CreateClient(
            handler,
            new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["AmbientApi:Resilience:MaxRetryAttempts"] = "1",
                ["AmbientApi:Resilience:BaseRetryDelayMilliseconds"] = "1",
            });

        await Should.ThrowAsync<AmbientApiRateLimitException>(
            () => client.GetFromJsonAsync<List<object>>("devices", "key", "app"));

        handler.Requests.Count.ShouldBe(2);
    }

    [Fact]
    public async Task GetFromJsonAsyncCircuitBreakerIsScopedToApplicationKey()
    {
        // Trip the circuit for "app-key-one" by exhausting the failure threshold.
        var circuitState = new AmbientCircuitBreakerState();
        var failingHandler = new CapturingHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));
        var client1 = CreateClientWithState(
            failingHandler,
            circuitState,
            new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["AmbientApi:Resilience:MaxRetryAttempts"] = "0",
                ["AmbientApi:Resilience:CircuitBreakerFailureThreshold"] = "1",
                ["AmbientApi:Resilience:CircuitBreakerBreakDurationSeconds"] = "30",
            });

        await Should.ThrowAsync<HttpRequestException>(
            () => client1.GetFromJsonAsync<List<object>>("devices", "key", "app-key-one"));

        // Circuit is now open for "app-key-one" — a second call with the same key should short-circuit.
        await Should.ThrowAsync<AmbientCircuitOpenException>(
            () => client1.GetFromJsonAsync<List<object>>("devices", "key", "app-key-one"));

        // A different application key must reach the server — its circuit is independent.
        var successHandler = new CapturingHttpMessageHandler(_ => JsonResponse("[]"));
        var client2 = CreateClientWithState(
            successHandler,
            circuitState,
            new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["AmbientApi:Resilience:CircuitBreakerBreakDurationSeconds"] = "30",
            });

        var result = await client2.GetFromJsonAsync<List<object>>("devices", "key", "app-key-two");

        result.ShouldBeEmpty();
        successHandler.Requests.Count.ShouldBe(1);
    }

    [Fact]
    public async Task GetFromJsonAsyncDoesNotTripCircuitBreakerOnAuthFailure()
    {
        var circuitState = new AmbientCircuitBreakerState();
        var handler = new CapturingHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.Unauthorized));
        var client = CreateClientWithState(handler, circuitState);

        // Fire an auth failure — should not count toward circuit threshold.
        await Should.ThrowAsync<AmbientApiAuthException>(
            () => client.GetFromJsonAsync<List<object>>("devices", "key", "app"));

        // A subsequent call must reach the server (circuit is still closed).
        var handler2 = new CapturingHttpMessageHandler(_ => JsonResponse("[]"));
        var client2 = CreateClientWithState(handler2, circuitState);
        await client2.GetFromJsonAsync<List<object>>("devices", "key", "app");
        handler2.Requests.Count.ShouldBe(1);
    }

    [Theory]
    [InlineData(HttpStatusCode.Unauthorized)]
    [InlineData(HttpStatusCode.Forbidden)]
    [InlineData(HttpStatusCode.NotFound)]
    public async Task ExceptionMessageDoesNotContainKeyMaterial(HttpStatusCode statusCode)
    {
        const string ApiKey = "super-secret-api-key";
        const string AppKey = "super-secret-app-key";
        var handler = new CapturingHttpMessageHandler(_ => new HttpResponseMessage(statusCode));
        var client = CreateClient(handler);

        var ex = await Should.ThrowAsync<ExpectedApplicationException>(
            () => client.GetFromJsonAsync<List<object>>("devices", ApiKey, AppKey));

        ex.Message.ShouldNotContain(ApiKey);
        ex.Message.ShouldNotContain(AppKey);
    }

    [Fact]
    public async Task RateLimitExceptionMessageDoesNotContainKeyMaterial()
    {
        const string ApiKey = "super-secret-api-key";
        const string AppKey = "super-secret-app-key";
        var handler = new CapturingHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.TooManyRequests));
        var client = CreateClient(
            handler,
            new Dictionary<string, string?>(StringComparer.Ordinal)
            {
                ["AmbientApi:Resilience:MaxRetryAttempts"] = "0",
                ["AmbientApi:Resilience:BaseRetryDelayMilliseconds"] = "1",
            });

        var ex = await Should.ThrowAsync<AmbientApiRateLimitException>(
            () => client.GetFromJsonAsync<List<object>>("devices", ApiKey, AppKey));

        ex.Message.ShouldNotContain(ApiKey);
        ex.Message.ShouldNotContain(AppKey);
    }

    // --- Helpers ---

    private static RateLimitedApiClient CreateClient(
        HttpMessageHandler handler,
        Dictionary<string, string?>? overrides = null)
    {
        return CreateClientWithState(handler, new AmbientCircuitBreakerState(), overrides);
    }

    private static RateLimitedApiClient CreateClientWithState(
        HttpMessageHandler handler,
        AmbientCircuitBreakerState circuitBreakerState,
        Dictionary<string, string?>? overrides = null)
    {
        // Default test values: zero-delay intervals and minimal retry counts so tests run fast.
        var configurationValues = new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["AmbientApi:RateLimits:UserApiKeyIntervalMilliseconds"] = "0",
            ["AmbientApi:RateLimits:ApplicationKeyIntervalMilliseconds"] = "0",
            ["AmbientApi:Resilience:MaxRetryAttempts"] = "0",
            ["AmbientApi:Resilience:BaseRetryDelayMilliseconds"] = "1",
            ["AmbientApi:Resilience:CircuitBreakerFailureThreshold"] = "5",
            ["AmbientApi:Resilience:CircuitBreakerBreakDurationSeconds"] = "1",
        };

        if (overrides != null)
        {
            foreach (var (key, value) in overrides)
            {
                configurationValues[key] = value;
            }
        }

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(configurationValues)
            .Build();

        var ambientOptions = new AmbientApiOptions();
        configuration.GetSection(AmbientApiOptions.SectionName).Bind(ambientOptions);

        return new RateLimitedApiClient(
            new TestHttpClientFactory(handler),
            Options.Create(ambientOptions),
            new AmbientRateLimitState(),
            circuitBreakerState,
            Mock.Of<ILogger<RateLimitedApiClient>>());
    }

    private static HttpResponseMessage JsonResponse(string json)
    {
        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json"),
        };
    }
}

internal sealed class CapturingHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> responseFactory)
    : HttpMessageHandler
{
    public List<HttpRequestMessage> Requests { get; } = [];

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        Requests.Add(request);
        return Task.FromResult(responseFactory(request));
    }
}

internal sealed class TestHttpClientFactory(HttpMessageHandler handler) : IHttpClientFactory
{
    public HttpClient CreateClient(string name)
    {
        return new HttpClient(handler, disposeHandler: false)
        {
            BaseAddress = new Uri("https://api.ambientweather.net/v1/"),
        };
    }
}
