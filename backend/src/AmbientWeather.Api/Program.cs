using System.Reflection;
using System.Security.Claims;
using System.Threading.RateLimiting;
using AmbientWeather.Api.Controllers;
using AmbientWeather.Api.Configuration;
using AmbientWeather.Api.Hubs;
using AmbientWeather.Api.Logging;
using AmbientWeather.Api.Telemetry;
using AmbientWeather.Api.Middleware;
using AmbientWeather.Api.Services;
using AmbientWeather.Api.Swagger;
using AmbientWeather.Infrastructure.Services;
using AmbientWeather.Application;
using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.Common;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Infrastructure;
using Azure.Monitor.OpenTelemetry.AspNetCore;
using OpenTelemetry.Trace;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.OpenApi;
using Serilog;
using Serilog.Formatting.Compact;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, _, loggerConfig) =>
{
    loggerConfig
        .ReadFrom.Configuration(context.Configuration)
        .Enrich.FromLogContext()
        .Enrich.WithProperty("Application", context.Configuration["AppName"] ?? "AmbientWeather.Api")
        .Enrich.WithProperty("Environment", context.HostingEnvironment.EnvironmentName)
        .Enrich.With<SensitivePropertyRedactor>();

    if (context.HostingEnvironment.IsDevelopment() || context.HostingEnvironment.IsEnvironment("Testing"))
    {
#pragma warning disable CA1305 // Serilog Console sink does not perform locale-sensitive formatting
        loggerConfig.WriteTo.Console();
#pragma warning restore CA1305
    }
    else
    {
        loggerConfig.WriteTo.Console(new CompactJsonFormatter());
    }
});

var appName = builder.Configuration["AppName"] ?? "Ambient Weather Dashboard";
var authOptions = ApplicationAuthenticationOptions.FromConfiguration(builder.Configuration);
builder.Services.AddOptions<ApplicationAuthenticationOptions>()
    .Configure(options =>
    {
        options.Authority = authOptions.Authority;
        options.Audience = authOptions.Audience;
    })
    .ValidateDataAnnotations();

ValidateAllowedHostsForEnvironment(builder.Configuration, builder.Environment);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserService, HttpContextCurrentUserService>();

var jwtConfigured = authOptions.IsConfigured;

// ASP0025: use AddAuthorizationBuilder (preferred over AddAuthorization in ASP.NET Core 8+)
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("AuthenticatedUser", policy =>
    {
        // Require a valid JWT whenever Auth0 is configured, including Development.
        // The bypass is only active when JWT is not configured (dev without an Auth0 tenant).
        // Set DevAuthBypass=true in appsettings.Development.json to explicitly restore the
        // bypass even when Auth0 is configured — useful for Swagger-only local sessions.
        var devBypass = builder.Environment.IsDevelopment()
            && (!jwtConfigured
                || string.Equals(
                    builder.Configuration["DevAuthBypass"],
                    "true",
                    StringComparison.OrdinalIgnoreCase));

        if (devBypass)
        {
            policy.RequireAssertion(_ => true);
        }
        else
        {
            policy.RequireAuthenticatedUser();
        }
    });
if (!jwtConfigured
    && !builder.Environment.IsDevelopment()
    && !builder.Environment.IsEnvironment("Testing"))
{
    throw new InvalidOperationException(
        "JWT authentication is required outside Development and Testing. " +
        "Configure Authentication:Authority and Authentication:Audience (or Auth0:Authority and Auth0:Audience).");
}

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, options =>
    {
        if (jwtConfigured)
        {
            options.Authority = authOptions.Authority;
            options.Audience = authOptions.Audience;
            options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
        }

        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrWhiteSpace(accessToken)
                    && path.Equals("/hubs/weather", StringComparison.OrdinalIgnoreCase))
                {
                    context.Token = accessToken;
                }

                return Task.CompletedTask;
            },
        };

        // Without configured authority the handler still challenges unauthenticated
        // requests with 401, which is the correct behavior in all environments.
    });

builder.Services.AddRateLimiter(options =>
{
    // Claim resolution order matches HttpContextCurrentUserService: NameIdentifier first, then
    // raw "sub". JWT middleware maps the "sub" claim to ClaimTypes.NameIdentifier by default, so
    // reading only "sub" would miss authenticated users and fall back to IP partitioning.
    static string SubjectPartition(HttpContext ctx) =>
        ctx.User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? ctx.User.FindFirstValue("sub")
        ?? ctx.Connection.RemoteIpAddress?.ToString()
        ?? "anonymous";

    options.AddPolicy("per-user", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: SubjectPartition(context),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 60,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
            }));

    // Tighter limit for credential saves — each save triggers an outbound Ambient validation call.
    options.AddPolicy("credential-save", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: SubjectPartition(context),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromHours(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
            }));

    // Neighbor refresh clears a Redis cache entry and calls public provider APIs.
    // More permissive than credential-save but still bounded to prevent provider abuse.
    options.AddPolicy("neighbor-refresh", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: SubjectPartition(context),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(15),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
            }));

    // Metric history can fan out to multiple Ambient pages on cache misses, so keep it tighter
    // than the generic authenticated-user policy.
    options.AddPolicy("metric-history", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: SubjectPartition(context),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
            }));

    options.OnRejected = async (ctx, ct) =>
    {
        ctx.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await ctx.HttpContext.Response.WriteAsJsonAsync(
            new ErrorResponseDto
            {
                Error = "rate_limit_exceeded",
                Message = "Too many requests. Retry after a moment.",
                StatusCode = 429,
            },
            cancellationToken: ct).ConfigureAwait(false);
    };
});

builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = $"{appName} API",
        Version = "v1",
        Description = $"BFF API for the {appName} web application.",
    });

    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
    {
        options.IncludeXmlComments(xmlPath);
    }

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description = "Paste your Auth0 access token (without 'Bearer ' prefix).",
    });

    options.OperationFilter<AuthorizeCheckOperationFilter>();
});
var corsAllowedOrigin = builder.Configuration["Cors:AllowedOrigin"];
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        if (string.IsNullOrWhiteSpace(corsAllowedOrigin))
        {
            return;
        }

        policy.WithOrigins(corsAllowedOrigin)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

builder.Services.AddSignalR();
builder.Services.AddSingleton<IWeatherHubPusher, WeatherHubPusher>();
builder.Services.AddHostedService<RealtimeSubscriberService>();
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration, builder.Environment);

// Health checks — liveness check always registered; readiness checks added conditionally in Infrastructure DI
builder.Services.AddHealthChecks()
    .AddCheck("live", () => HealthCheckResult.Healthy("Process is running."), tags: ["live", "ready"]);

// Optional Azure Monitor OpenTelemetry — disabled without a connection string
var telemetryConnectionString =
    builder.Configuration["AzureMonitor:ConnectionString"]
    ?? builder.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"];
if (!string.IsNullOrWhiteSpace(telemetryConnectionString))
{
    builder.Services.AddOpenTelemetry()
        .UseAzureMonitor(options => options.ConnectionString = telemetryConnectionString)
        .WithTracing(b => b.AddProcessor(new AmbientUrlRedactionProcessor()));
}

var app = builder.Build();

if (string.IsNullOrWhiteSpace(telemetryConnectionString))
{
    Log.Information(
        "Azure Monitor telemetry is disabled. Set AzureMonitor:ConnectionString or APPLICATIONINSIGHTS_CONNECTION_STRING to enable.");
}

// Testing also serves the OpenAPI document so SwaggerContractTests can verify
// the committed snapshot without running under a different environment.
if (app.Environment.IsDevelopment() || app.Environment.IsEnvironment("Testing"))
{
    app.UseSwagger();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", $"{appName} API v1");
        options.RoutePrefix = "swagger";
        options.DocumentTitle = $"{appName} API";
    });
}

app.UseSerilogRequestLogging();
if (!app.Environment.IsEnvironment("Testing"))
{
    app.UseHttpsRedirection();
}
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseMiddleware<GlobalExceptionHandlerMiddleware>();
app.UseCors("Frontend");
app.UseAuthentication();
// Phase 8+: replace this fixed-window limiter with a Redis-backed IRateLimiterPolicy
// for shared counters when the application scales horizontally.
// Placed after UseAuthentication so the identity claims are available for per-user partitioning.
var disableRateLimiterForTesting = app.Environment.IsEnvironment("Testing")
    && app.Configuration.GetValue<bool>("Testing:DisableRateLimiter");
if (!disableRateLimiterForTesting)
{
    app.UseRateLimiter();
}
// ApplicationKeyAuthMiddleware was removed in Phase 7 — /api/v1/devices is now protected by
// [Authorize] + per-user credential flow. Phase 8 replaces the legacy route with metric history endpoints.
app.UseAuthorization();

app.MapHealthChecks("/api/health/live", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("live"),
    ResponseWriter = HealthResponseWriter.WriteAsync,
    AllowCachingResponses = false,
}).AllowAnonymous();

app.MapHealthChecks("/api/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"),
    ResponseWriter = HealthResponseWriter.WriteAsync,
    AllowCachingResponses = false,
}).AllowAnonymous();

app.MapControllers();
app.MapHub<WeatherHub>("/hubs/weather").RequireAuthorization("AuthenticatedUser");

if (app.Environment.IsEnvironment("Testing"))
{
    app.MapGet("/test/throw", ThrowTestException);
    app.MapGet("/test/throw-circuit-open", ThrowCircuitOpenException);
}

static void ValidateAllowedHostsForEnvironment(IConfiguration configuration, IHostEnvironment environment)
{
    if (environment.IsDevelopment() || environment.IsEnvironment("Testing"))
    {
        return;
    }

    var allowedHosts = configuration["AllowedHosts"];
    if (string.IsNullOrWhiteSpace(allowedHosts)
        || string.Equals(allowedHosts.Trim(), "*", StringComparison.Ordinal))
    {
        throw new InvalidOperationException(
            "AllowedHosts must be restricted outside Development and Testing. Configure AllowedHosts with the production hostnames.");
    }
}

await app.RunAsync().ConfigureAwait(false);

static IResult ThrowTestException()
{
    throw new InvalidOperationException("Test exception for global exception middleware.");
}

static IResult ThrowCircuitOpenException()
{
    throw new AmbientCircuitOpenException();
}
