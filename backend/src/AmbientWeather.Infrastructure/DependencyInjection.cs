using AmbientWeather.Application.Interfaces;
using AmbientWeather.Infrastructure.Alerts;
using AmbientWeather.Domain.Neighbors;
using AmbientWeather.Infrastructure.Ambient;
using AmbientWeather.Infrastructure.Configuration;
using AmbientWeather.Infrastructure.Data;
using AmbientWeather.Infrastructure.HealthChecks;
using AmbientWeather.Infrastructure.Neighbors;
using AmbientWeather.Infrastructure.PublicSources;
using AmbientWeather.Infrastructure.Repositories;
using AmbientWeather.Infrastructure.Services;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using StackExchange.Redis;

namespace AmbientWeather.Infrastructure;

/// <summary>
/// Dependency injection registration for Infrastructure services.
/// </summary>
public static class DependencyInjection
{
    /// <summary>
    /// Registers Infrastructure services and external integrations.
    /// </summary>
    /// <param name="services">The service collection to register dependencies with.</param>
    /// <param name="configuration">The application configuration.</param>
    /// <param name="environment">The current host environment.</param>
    /// <returns>The updated service collection.</returns>
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        // 1. Data Protection for credential encryption
        var keyRingPath = configuration["DataProtection:KeyRingPath"]
            ?? Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "AmbientWeatherDashboard",
                "keys");
        Directory.CreateDirectory(keyRingPath);
        services
            .AddDataProtection()
            .SetApplicationName("AmbientWeatherDashboard")
            .PersistKeysToFileSystem(new DirectoryInfo(keyRingPath));

        // 2. Register your services
        services.AddScoped<ICredentialEncryptionService, CredentialEncryptionService>();
        services.AddScoped<IDeviceHistoryService, DeviceHistoryService>();
        services.AddScoped<IAmbientHistoryService, AmbientHistoryService>();
        AddRedisOptions(services, configuration, environment);
        AddUserAgentOptions(services, configuration, environment);
        AddPersistence(services, configuration, environment);
        AddDistributedCache(services, configuration, environment);
        AddRealtime(services, configuration, environment);

        // AmbientApiOptions — all values have safe defaults, so ValidateOnStart is safe in all environments.
        services.AddOptions<AmbientApiOptions>()
            .BindConfiguration(AmbientApiOptions.SectionName)
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddSingleton<AmbientRateLimitState>();
        services.AddSingleton<AmbientCircuitBreakerState>();
        services.AddSingleton<RateLimitedApiClient>();
        services.AddScoped<IAmbientRestClient, AmbientRestClient>();

        // 3. Register your Ambient Client (from previous steps)
        services.AddHttpClient(RateLimitedApiClient.HttpClientName, (sp, client) =>
        {
            var ambientOptions = sp.GetRequiredService<IOptions<AmbientApiOptions>>().Value;
            client.BaseAddress = new Uri(ambientOptions.BaseUrl);
            client.Timeout = TimeSpan.FromSeconds(15);
            client.DefaultRequestHeaders.Add("Accept", "application/json");
            AddUserAgentHeader(client, sp.GetRequiredService<IOptions<UserAgentOptions>>().Value);
        });

        services.AddScoped<INeighborDiscoveryService, NeighborDiscoveryService>();
        services.AddSingleton<INeighborAggregationService, NeighborAggregationService>();
        services.AddScoped<IWeatherAlertService, WeatherGovAlertService>();
        services.AddScoped<IPublicSourceCurrentReadingService, PublicSourceCurrentReadingService>();
        services.AddScoped<IPublicSourceDiscoveryService, PublicSourceDiscoveryService>();
        services.AddScoped<ILocationGeocodingService, NominatimLocationGeocodingService>();
        AddNeighborProviders(services, configuration);

        return services;
    }

    private static void AddRedisOptions(
        IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        var redisOptions = RedisOptions.FromConfiguration(configuration);
        var optionsBuilder = services.AddOptions<RedisOptions>()
            .Configure(options =>
            {
                options.ConnectionString = redisOptions.ConnectionString;
                options.InstanceName = redisOptions.InstanceName;
            })
            .ValidateDataAnnotations();

        if (!environment.IsDevelopment() && !environment.IsEnvironment("Testing"))
        {
            optionsBuilder
                .Validate(options => options.IsConfigured, "Redis connection string is required outside Development and Testing.")
                .ValidateOnStart();
        }
    }

    private static void AddUserAgentOptions(
        IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        var userAgentOptions = UserAgentOptions.FromConfiguration(configuration);
        var optionsBuilder = services.AddOptions<UserAgentOptions>()
            .Configure(options =>
            {
                options.Value = userAgentOptions.Value;
                options.ProductName = userAgentOptions.ProductName;
                options.Version = userAgentOptions.Version;
                options.Contact = userAgentOptions.Contact;
            })
            .ValidateDataAnnotations();

        if (!environment.IsDevelopment() && !environment.IsEnvironment("Testing"))
        {
            optionsBuilder
                .Validate(
                    options => options.HasProviderContact,
                    "UserAgent must include contact information outside Development and Testing.")
                .ValidateOnStart();
        }
    }

    private static void AddPersistence(
        IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        var postgresConnectionString =
            configuration.GetConnectionString("Postgres")
            ?? configuration.GetConnectionString("PostgreSQL")
            ?? configuration.GetConnectionString("DefaultConnection")
            ?? configuration["Postgres:ConnectionString"];

        if (string.IsNullOrWhiteSpace(postgresConnectionString))
        {
            if (environment.IsEnvironment("Testing"))
            {
                return;
            }

            throw new InvalidOperationException(
                "PostgreSQL connection is required. Configure ConnectionStrings:Postgres or Postgres:ConnectionString.");
        }

        services.AddDbContext<AmbientWeatherDbContext>(options =>
            options.UseNpgsql(postgresConnectionString));
        services.AddScoped<IAmbientCredentialStore, AmbientCredentialStore>();
        services.AddScoped<IUserPreferencesStore, UserPreferencesStore>();
        services.AddScoped<IUserStationStore, WeatherStationRepository>();
        services.AddScoped<IPublicWeatherSourceStore, PublicWeatherSourceRepository>();
        services.AddScoped<IDashboardLayoutStore, DashboardLayoutStore>();
        services.AddScoped<IWeatherReadingRepository, WeatherReadingRepository>();
        services.AddScoped<IHistorySyncTargetRepository, HistorySyncTargetRepository>();
        services.AddSingleton<IRealtimeSubscriptionRegistry, DatabaseRealtimeSubscriptionRegistry>();

        services.AddHealthChecks()
            .AddDbContextCheck<AmbientWeatherDbContext>(tags: ["ready"]);
    }

    private static void AddRealtime(
        IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment _)
    {
        // Always available: latest-reading cache uses IDistributedCache (Redis or in-memory).
        services.AddSingleton<ILatestReadingCache, DistributedLatestReadingCache>();

        var redisOptions = RedisOptions.FromConfiguration(configuration);

        if (redisOptions.IsConfigured)
        {
            // Redis available: register a multiplexer for pub/sub fan-out and the full publisher.
            services.AddSingleton<IConnectionMultiplexer>(_ =>
                ConnectionMultiplexer.Connect(redisOptions.ConnectionString!));
            services.AddSingleton<IRealtimeReadingPublisher, RedisRealtimeReadingPublisher>();
            services.AddSingleton<IRealtimeReadingSubscriber, RedisRealtimeReadingSubscriber>();
        }
        else
        {
            // Dev/Test: cache-only publisher (no pub/sub).
            services.AddSingleton<IRealtimeReadingPublisher, LocalRealtimeReadingPublisher>();
            services.AddSingleton<IRealtimeReadingSubscriber, NullRealtimeReadingSubscriber>();
        }

        // Socket.IO client factory (always registered; no-ops when no subscriptions exist).
        services.AddSingleton<IAmbientSocketClientFactory, AmbientSocketClientFactory>();

        // Fallback registry for Testing/Development without a database. AddPersistence registers
        // DatabaseRealtimeSubscriptionRegistry first when DB is configured; TryAddSingleton is a
        // no-op in that case and only activates the null implementation when no DB is present.
        services.TryAddSingleton<IRealtimeSubscriptionRegistry, NullRealtimeSubscriptionRegistry>();
    }

    private static void AddNeighborProviders(
        IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddHttpClient(AmbientOpenWeatherProvider.HttpClientName, (sp, client) =>
        {
            client.BaseAddress = new Uri("https://lightning.ambientweather.net");
            client.Timeout = TimeSpan.FromSeconds(10);
            client.DefaultRequestHeaders.Add("Accept", "application/json");
            AddUserAgentHeader(client, sp.GetRequiredService<IOptions<UserAgentOptions>>().Value);
        });

        services.AddHttpClient(WeatherGovNearbyObservationProvider.HttpClientName, (sp, client) =>
        {
            client.BaseAddress = new Uri("https://api.weather.gov");
            client.Timeout = TimeSpan.FromSeconds(10);
            client.DefaultRequestHeaders.Add("Accept", "application/geo+json");
            AddUserAgentHeader(client, sp.GetRequiredService<IOptions<UserAgentOptions>>().Value);
        });

        services.AddHttpClient(OpenMeteoNearbyBaselineProvider.HttpClientName, (sp, client) =>
        {
            client.BaseAddress = new Uri("https://api.open-meteo.com");
            client.Timeout = TimeSpan.FromSeconds(10);
            client.DefaultRequestHeaders.Add("Accept", "application/json");
            AddUserAgentHeader(client, sp.GetRequiredService<IOptions<UserAgentOptions>>().Value);
        });

        services.AddHttpClient(OpenMeteoNearbyBaselineProvider.OverpassClientName, (sp, client) =>
        {
            client.BaseAddress = new Uri("https://overpass-api.de");
            client.Timeout = TimeSpan.FromSeconds(10);
            client.DefaultRequestHeaders.Add("Accept", "application/json");
            AddUserAgentHeader(client, sp.GetRequiredService<IOptions<UserAgentOptions>>().Value);
        });

        services.AddHttpClient(PublicSourceDiscoveryService.NominatimClientName, (sp, client) =>
        {
            client.BaseAddress = new Uri("https://nominatim.openstreetmap.org");
            client.Timeout = TimeSpan.FromSeconds(10);
            client.DefaultRequestHeaders.Add("Accept", "application/json");
            AddUserAgentHeader(client, sp.GetRequiredService<IOptions<UserAgentOptions>>().Value);
        });

        services.AddSingleton<AmbientOpenWeatherProvider>();
        services.AddSingleton<WeatherGovNearbyObservationProvider>();
        services.AddSingleton<OpenMeteoNearbyBaselineProvider>();

        // Ordered list: Ambient first, NWS second, Open-Meteo third.
        services.AddSingleton<IReadOnlyList<INearbyWeatherProvider>>(sp =>
            new List<INearbyWeatherProvider>
            {
                sp.GetRequiredService<AmbientOpenWeatherProvider>(),
                sp.GetRequiredService<WeatherGovNearbyObservationProvider>(),
                sp.GetRequiredService<OpenMeteoNearbyBaselineProvider>(),
            }.AsReadOnly());
    }

    private static void AddUserAgentHeader(HttpClient client, UserAgentOptions options)
    {
        client.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent", options.ToHeaderValue());
    }

    private static void AddDistributedCache(
        IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        var redisOptions = RedisOptions.FromConfiguration(configuration);

        if (redisOptions.IsConfigured)
        {
            services.AddStackExchangeRedisCache(options =>
            {
                options.Configuration = redisOptions.ConnectionString;
                options.InstanceName = redisOptions.InstanceName;
            });
        }
        else if (environment.IsDevelopment() || environment.IsEnvironment("Testing"))
        {
            services.AddDistributedMemoryCache();
        }
        else
        {
            throw new InvalidOperationException(
                "Redis cache connection is required outside Development and Testing. Configure ConnectionStrings:Redis or Redis:ConnectionString.");
        }

        services.AddHealthChecks()
            .AddCheck<CacheHealthCheck>("cache", tags: ["ready"]);
    }
}
