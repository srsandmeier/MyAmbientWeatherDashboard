using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace AmbientWeather.Infrastructure.Data;

/// <summary>
/// Design-time factory used by <c>dotnet ef</c> to create a <see cref="AmbientWeatherDbContext"/>
/// without the full application host.
/// </summary>
public class AmbientWeatherDbContextFactory : IDesignTimeDbContextFactory<AmbientWeatherDbContext>
{
    /// <inheritdoc />
    public AmbientWeatherDbContext CreateDbContext(string[] args)
    {
        var apiProjectPath = ResolveApiProjectPath();
        var config = new ConfigurationBuilder()
            .AddJsonFile(Path.Combine(apiProjectPath, "appsettings.json"), optional: true)
            .AddJsonFile(Path.Combine(apiProjectPath, "appsettings.Development.json"), optional: true)
            .AddUserSecrets<AmbientWeatherDbContextFactory>(optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString =
            config.GetConnectionString("Postgres")
            ?? config.GetConnectionString("PostgreSQL")
            ?? config.GetConnectionString("DefaultConnection")
            ?? config["Postgres:ConnectionString"];

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "PostgreSQL connection is required for design-time EF operations. " +
                "Configure ConnectionStrings:Postgres in the API user-secrets store or environment.");
        }

        var options = new DbContextOptionsBuilder<AmbientWeatherDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        return new AmbientWeatherDbContext(options);
    }

    private static string ResolveApiProjectPath()
    {
        var currentDirectory = Directory.GetCurrentDirectory();
        var candidates = new[]
        {
            Path.Combine(currentDirectory, "backend", "src", "AmbientWeather.Api"),
            Path.Combine(currentDirectory, "..", "AmbientWeather.Api"),
            Path.Combine(currentDirectory, "..", "..", "AmbientWeather.Api"),
            currentDirectory
        };

        return candidates
            .Select(Path.GetFullPath)
            .FirstOrDefault(path => File.Exists(Path.Combine(path, "AmbientWeather.Api.csproj")))
            ?? currentDirectory;
    }
}
