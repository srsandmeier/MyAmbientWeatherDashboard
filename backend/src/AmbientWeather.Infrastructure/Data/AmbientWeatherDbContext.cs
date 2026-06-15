using AmbientWeather.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AmbientWeather.Infrastructure.Data;

/// <summary>
/// Entity Framework Core DbContext for Ambient Weather Dashboard.
/// Manages persistence of weather readings and device configuration.
/// </summary>
public class AmbientWeatherDbContext : DbContext
{
    public AmbientWeatherDbContext(DbContextOptions<AmbientWeatherDbContext> options)
        : base(options)
    {
    }

    /// <summary>
    /// Historical weather readings from devices.
    /// </summary>
    public DbSet<WeatherReading> WeatherReadings { get; set; } = null!;

    /// <summary>
    /// Application users.
    /// </summary>
    public DbSet<AppUser> Users { get; set; } = null!;

    /// <summary>
    /// Encrypted user Ambient Weather credentials.
    /// </summary>
    public DbSet<UserAmbientCredentials> UserAmbientCredentials { get; set; } = null!;

    /// <summary>
    /// User preferences.
    /// </summary>
    public DbSet<UserPreferences> UserPreferences { get; set; } = null!;

    /// <summary>
    /// Dashboard layouts.
    /// </summary>
    public DbSet<DashboardLayout> DashboardLayouts { get; set; } = null!;

    /// <summary>
    /// User-owned and cached weather stations.
    /// </summary>
    public DbSet<WeatherStation> WeatherStations { get; set; } = null!;

    /// <summary>
    /// Public weather sources selected by users.
    /// </summary>
    public DbSet<PublicWeatherSource> PublicWeatherSources { get; set; } = null!;

    /// <summary>
    /// Cached nearby public stations discovered by neighbor providers, keyed by user hash.
    /// </summary>
    public DbSet<NeighborStationCache> NeighborStationCaches { get; set; } = null!;

    /// <summary>
    /// Configures the data model and database schema.
    /// </summary>
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        ConfigureUsers(modelBuilder);
        ConfigureCredentials(modelBuilder);
        ConfigurePreferences(modelBuilder);
        ConfigureDashboardLayouts(modelBuilder);
        ConfigureWeatherStations(modelBuilder);
        ConfigurePublicWeatherSources(modelBuilder);
        ConfigureNeighborStationCache(modelBuilder);
        ConfigureWeatherReadings(modelBuilder);
    }

    private static void ConfigureWeatherReadings(ModelBuilder modelBuilder)
    {
        var weatherReadingBuilder = modelBuilder.Entity<WeatherReading>();
        weatherReadingBuilder.ToTable("weather_readings");
        weatherReadingBuilder.HasKey(e => e.Id);

        // Index for efficient queries by device and date (Descending on DateUtc for recent-first queries)
        weatherReadingBuilder
            .HasIndex(e => new { e.DeviceMacAddress, e.DateUtc })
            .IsDescending(false, true);

        // Index for time-range queries
        weatherReadingBuilder
            .HasIndex(e => new { e.DeviceMacAddress, e.CreatedAtUtc });

        // Index on CreatedAtUtc for cleanup/archival operations
        weatherReadingBuilder
            .HasIndex(e => e.CreatedAtUtc);

        // Configure columns
        weatherReadingBuilder.Property(e => e.Id).ValueGeneratedOnAdd();
        weatherReadingBuilder.Property(e => e.DeviceMacAddress).HasMaxLength(17).IsRequired();
        weatherReadingBuilder.Property(e => e.DateUtc).IsRequired();
        weatherReadingBuilder.Property(e => e.CreatedAtUtc).IsRequired();
        weatherReadingBuilder.Property(e => e.StoredAtUtc).IsRequired();
        weatherReadingBuilder.Property(e => e.Tz).HasMaxLength(50);

        // Nullable numeric properties
        weatherReadingBuilder.Property(e => e.TempInF).HasPrecision(5, 2);
        weatherReadingBuilder.Property(e => e.TempF).HasPrecision(5, 2);
        weatherReadingBuilder.Property(e => e.FeelsLike).HasPrecision(5, 2);
        weatherReadingBuilder.Property(e => e.FeelsLikeIn).HasPrecision(5, 2);
        weatherReadingBuilder.Property(e => e.DewPoint).HasPrecision(5, 2);
        weatherReadingBuilder.Property(e => e.DewPointIn).HasPrecision(5, 2);
        weatherReadingBuilder.Property(e => e.BaromRelIn).HasPrecision(6, 3);
        weatherReadingBuilder.Property(e => e.BaromAbsIn).HasPrecision(6, 3);
        weatherReadingBuilder.Property(e => e.WindSpeedMph).HasPrecision(6, 2);
        weatherReadingBuilder.Property(e => e.WindGustMph).HasPrecision(6, 2);
        weatherReadingBuilder.Property(e => e.MaxDailyGust).HasPrecision(6, 2);
        weatherReadingBuilder.Property(e => e.HourlyRainIn).HasPrecision(5, 3);
        weatherReadingBuilder.Property(e => e.EventRainIn).HasPrecision(5, 3);
        weatherReadingBuilder.Property(e => e.DailyRainIn).HasPrecision(6, 3);
        weatherReadingBuilder.Property(e => e.WeeklyRainIn).HasPrecision(6, 3);
        weatherReadingBuilder.Property(e => e.MonthlyRainIn).HasPrecision(6, 3);
        weatherReadingBuilder.Property(e => e.YearlyRainIn).HasPrecision(8, 3);
        weatherReadingBuilder.Property(e => e.TotalRainIn).HasPrecision(8, 3);
        weatherReadingBuilder.Property(e => e.SolarRadiation).HasPrecision(8, 2);
    }

    private static void ConfigureUsers(ModelBuilder modelBuilder)
    {
        var builder = modelBuilder.Entity<AppUser>();
        builder.ToTable("users");
        builder.HasKey(e => e.Id);
        builder.HasIndex(e => e.AuthProviderSubject).IsUnique();
        builder.Property(e => e.Id).HasColumnName("id");
        builder.Property(e => e.AuthProviderSubject).HasColumnName("auth_provider_sub").HasMaxLength(256).IsRequired();
        builder.Property(e => e.Email).HasColumnName("email").HasMaxLength(256);
        builder.Property(e => e.CreatedAtUtc).HasColumnName("created_at").IsRequired();
    }

    private static void ConfigureCredentials(ModelBuilder modelBuilder)
    {
        var builder = modelBuilder.Entity<UserAmbientCredentials>();
        builder.ToTable("user_ambient_credentials");
        builder.HasKey(e => e.UserId);
        builder.Property(e => e.UserId).HasColumnName("user_id");
        builder.Property(e => e.ApiKeyEncrypted).HasColumnName("api_key_encrypted").IsRequired();
        builder.Property(e => e.ApplicationKeyEncrypted).HasColumnName("application_key_encrypted").IsRequired();
        builder.Property(e => e.UpdatedAtUtc).HasColumnName("updated_at").IsRequired();
        builder
            .HasOne(e => e.User)
            .WithOne(e => e.AmbientCredentials)
            .HasForeignKey<UserAmbientCredentials>(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }

    private static void ConfigurePreferences(ModelBuilder modelBuilder)
    {
        var builder = modelBuilder.Entity<UserPreferences>();
        builder.ToTable("user_preferences");
        builder.HasKey(e => e.UserId);
        builder.Property(e => e.UserId).HasColumnName("user_id");
        builder.Property(e => e.TemperatureUnit).HasColumnName("temperature_unit").HasMaxLength(8).IsRequired();
        builder.Property(e => e.SpeedUnit).HasColumnName("speed_unit").HasMaxLength(8).IsRequired();
        builder.Property(e => e.PressureUnit).HasColumnName("pressure_unit").HasMaxLength(8).IsRequired();
        builder.Property(e => e.RainfallUnit).HasColumnName("rainfall_unit").HasMaxLength(8).IsRequired();
        builder.Property(e => e.DistanceUnit).HasColumnName("distance_unit").HasMaxLength(8).IsRequired();
        builder.Property(e => e.Theme).HasColumnName("theme").HasMaxLength(16).IsRequired();
        builder.Property(e => e.DateFormat).HasColumnName("date_format").HasMaxLength(16).IsRequired();
        builder.Property(e => e.NeighborConfigJson).HasColumnName("neighbor_config_json").HasColumnType("jsonb").IsRequired();
        builder.Property(e => e.DefaultWeatherStationId).HasColumnName("default_weather_station_id");
        builder.Property(e => e.UpdatedAtUtc).HasColumnName("updated_at").IsRequired();
        builder
            .HasOne(e => e.User)
            .WithOne(e => e.Preferences)
            .HasForeignKey<UserPreferences>(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);
        builder
            .HasOne(e => e.DefaultWeatherStation)
            .WithMany()
            .HasForeignKey(e => e.DefaultWeatherStationId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);
    }

    private static void ConfigureDashboardLayouts(ModelBuilder modelBuilder)
    {
        var builder = modelBuilder.Entity<DashboardLayout>();
        builder.ToTable("dashboard_layouts");
        builder.HasKey(e => e.Id);
        builder.HasIndex(e => new { e.UserId, e.Name }).IsUnique();
        // Filtered unique index: only one active layout is allowed per user.
        builder.HasIndex(e => e.UserId)
            .HasFilter("is_active = true")
            .IsUnique()
            .HasDatabaseName("ix_dashboard_layouts_user_active");
        builder.Property(e => e.Id).HasColumnName("id");
        builder.Property(e => e.UserId).HasColumnName("user_id");
        builder.Property(e => e.Name).HasColumnName("name").HasMaxLength(128).IsRequired();
        builder.Property(e => e.IsActive).HasColumnName("is_active").IsRequired();
        builder.Property(e => e.LayoutJson).HasColumnName("layout_json").HasColumnType("jsonb").IsRequired();
        builder.Property(e => e.UpdatedAtUtc).HasColumnName("updated_at").IsRequired();
        builder
            .HasOne(e => e.User)
            .WithMany(e => e.DashboardLayouts)
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }

    private static void ConfigureWeatherStations(ModelBuilder modelBuilder)
    {
        var builder = modelBuilder.Entity<WeatherStation>();
        builder.ToTable("weather_stations");
        builder.HasKey(e => e.Id);
        builder.HasIndex(e => new { e.UserId, e.MacAddress }).IsUnique();
        // Filtered unique index: only one primary station is allowed per user.
        builder.HasIndex(e => e.UserId)
            .HasFilter("is_primary = true")
            .IsUnique()
            .HasDatabaseName("ix_weather_stations_user_primary");
        builder.Property(e => e.Id).HasColumnName("id");
        builder.Property(e => e.UserId).HasColumnName("user_id");
        builder.Property(e => e.MacAddress).HasColumnName("mac_address").HasMaxLength(17).IsRequired();
        builder.Property(e => e.Name).HasColumnName("name").HasMaxLength(256);
        builder.Property(e => e.Nickname).HasColumnName("nickname").HasMaxLength(128);
        builder.Property(e => e.Latitude).HasColumnName("latitude");
        builder.Property(e => e.Longitude).HasColumnName("longitude");
        builder.Property(e => e.ElevationMeters).HasColumnName("elevation_m");
        builder.Property(e => e.Address).HasColumnName("address").HasMaxLength(512);
        builder.Property(e => e.Location).HasColumnName("location").HasMaxLength(256);
        builder.Property(e => e.IsPrimary).HasColumnName("is_primary").IsRequired();
        builder.Property(e => e.DisplayOnDashboard).HasColumnName("display_on_dashboard").IsRequired();
        builder.Property(e => e.SelectedMetricKeysJson).HasColumnName("selected_metric_keys_json").HasColumnType("jsonb");
        builder.Property(e => e.LastSyncAtUtc).HasColumnName("last_sync_at");
        builder
            .HasOne(e => e.User)
            .WithMany(e => e.WeatherStations)
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }

    private static void ConfigureNeighborStationCache(ModelBuilder modelBuilder)
    {
        var builder = modelBuilder.Entity<NeighborStationCache>();
        builder.ToTable("neighbor_station_cache");
        builder.HasKey(e => e.Id);
        builder.HasIndex(e => e.UserHash);
        builder.HasIndex(e => new { e.UserHash, e.Provider, e.SourceId }).IsUnique();
        builder.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
        builder.Property(e => e.UserHash).HasColumnName("user_hash").HasMaxLength(64).IsRequired();
        builder.Property(e => e.Provider).HasColumnName("provider").HasMaxLength(32).IsRequired();
        builder.Property(e => e.SourceId).HasColumnName("source_id").HasMaxLength(128).IsRequired();
        builder.Property(e => e.Name).HasColumnName("name").HasMaxLength(256);
        builder.Property(e => e.Lat).HasColumnName("lat");
        builder.Property(e => e.Lon).HasColumnName("lon");
        builder.Property(e => e.DistanceMiles).HasColumnName("distance_miles");
        builder.Property(e => e.LastObservedAtUtc).HasColumnName("last_observed_at");
        builder.Property(e => e.FreshnessMinutes).HasColumnName("freshness_minutes");
        builder.Property(e => e.RawReadingJson).HasColumnName("raw_reading_json").HasColumnType("text");
        builder.Property(e => e.CachedAtUtc).HasColumnName("cached_at").IsRequired();
    }

    private static void ConfigurePublicWeatherSources(ModelBuilder modelBuilder)
    {
        var builder = modelBuilder.Entity<PublicWeatherSource>();
        builder.ToTable("public_weather_sources");
        builder.HasKey(e => e.Id);
        builder.HasIndex(e => new { e.UserId, e.Provider, e.SourceId }).IsUnique();
        builder.HasIndex(e => new { e.UserId, e.IsEnabled });
        builder.Property(e => e.Id).HasColumnName("id");
        builder.Property(e => e.UserId).HasColumnName("user_id");
        builder.Property(e => e.Provider).HasColumnName("provider").HasMaxLength(32).IsRequired();
        builder.Property(e => e.SourceId).HasColumnName("source_id").HasMaxLength(128).IsRequired();
        builder.Property(e => e.DisplayLabel).HasColumnName("display_label").HasMaxLength(128).IsRequired();
        builder.Property(e => e.Latitude).HasColumnName("latitude").IsRequired();
        builder.Property(e => e.Longitude).HasColumnName("longitude").IsRequired();
        builder.Property(e => e.Timezone).HasColumnName("timezone").HasMaxLength(64);
        builder.Property(e => e.IsEnabled).HasColumnName("is_enabled").IsRequired();
        builder.Property(e => e.SelectedMetricKeysJson).HasColumnName("selected_metric_keys_json").HasColumnType("jsonb");
        builder.Property(e => e.CreatedAtUtc).HasColumnName("created_at").IsRequired();
        builder.Property(e => e.UpdatedAtUtc).HasColumnName("updated_at").IsRequired();
        builder
            .HasOne(e => e.User)
            .WithMany(e => e.PublicWeatherSources)
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
