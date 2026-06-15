using AmbientWeather.UnitTests.TestData;
using AmbientWeather.Application.DTOs.AmbientApi;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using AmbientWeather.Workers;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Shouldly;

namespace AmbientWeather.UnitTests.Workers;

public sealed class HistorySyncWorkerTests
{
    [Fact]
    public async Task SyncOnceAsyncDoesNotCallAmbientClientWhenDisabled()
    {
        var ambientClient = new Mock<IAmbientRestClient>();
        var worker = CreateWorker(
            ambientClient,
            Mock.Of<IWeatherReadingRepository>(),
            new HistorySyncWorkerOptions
            {
                Enabled = false,
                DeviceMacAddress = WeatherTestData.ColonMac
            });

        await worker.SyncOnceAsync();

        ambientClient.Verify(
            client => client.GetDeviceHistoryAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<int>(),
                It.IsAny<DateTime?>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task SyncOnceAsyncDoesNotCallAmbientClientWhenMacAddressIsInvalid()
    {
        var ambientClient = new Mock<IAmbientRestClient>();
        var worker = CreateWorker(
            ambientClient,
            Mock.Of<IWeatherReadingRepository>(),
            new HistorySyncWorkerOptions
            {
                Enabled = true,
                DeviceMacAddress = "not-a-mac"
            });

        await worker.SyncOnceAsync();

        ambientClient.Verify(
            client => client.GetDeviceHistoryAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<int>(),
                It.IsAny<DateTime?>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task SyncOnceAsyncStoresReadingsWhenEnabledAndConfigured()
    {
        var macAddress = WeatherTestData.ColonMac;
        var ambientClient = new Mock<IAmbientRestClient>();
        ambientClient
            .Setup(client => client.GetDeviceHistoryAsync(
                macAddress,
                "api-key",
                "application-key",
                12,
                null,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DeviceHistoryResponseDto
            {
                Readings =
                [
                    new WeatherReadingDto
                    {
                        DateUtc = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                        TempF = 72.5
                    }
                ],
                TotalReadings = 1
            });
        var repository = new Mock<IWeatherReadingRepository>();
        var worker = CreateWorker(
            ambientClient,
            repository.Object,
            new HistorySyncWorkerOptions
            {
                Enabled = true,
                DeviceMacAddress = macAddress,
                ApiKey = "api-key",
                ApplicationKey = "application-key",
                Limit = 12
            });

        await worker.SyncOnceAsync();

        repository.Verify(
            repo => repo.AddReadingsAsync(
                It.Is<IEnumerable<WeatherReading>>(readings =>
                    HasExpectedReading(readings)),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task SyncOnceAsyncSkipsWhenTargetRepositoryNotRegistered()
    {
        var ambientClient = new Mock<IAmbientRestClient>();
        var worker = CreateWorker(
            ambientClient,
            Mock.Of<IWeatherReadingRepository>(),
            new HistorySyncWorkerOptions { Enabled = true });

        await worker.SyncOnceAsync();

        ambientClient.Verify(
            client => client.GetDeviceHistoryAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<int>(),
                It.IsAny<DateTime?>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task SyncOnceAsyncStoresReadingsForConfiguredUserTargets()
    {
        var macAddress = WeatherTestData.ColonMac;
        var stationId = Guid.NewGuid();
        var ambientClient = new Mock<IAmbientRestClient>();
        ambientClient
            .Setup(client => client.GetDeviceHistoryAsync(
                macAddress,
                "api-key",
                "application-key",
                12,
                null,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DeviceHistoryResponseDto
            {
                Readings =
                [
                    new WeatherReadingDto
                    {
                        DateUtc = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                        TempF = 68.1
                    }
                ],
                TotalReadings = 1
            });
        var repository = new Mock<IWeatherReadingRepository>();
        var targetRepository = new Mock<IHistorySyncTargetRepository>();
        targetRepository
            .Setup(repo => repo.GetEnabledTargetsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(
            [
                new HistorySyncTarget(
                    Guid.NewGuid(),
                    stationId,
                    macAddress,
                    "api-key",
                    "application-key")
            ]);
        var worker = CreateWorker(
            ambientClient,
            repository.Object,
            new HistorySyncWorkerOptions
            {
                Enabled = true,
                Limit = 12
            },
            targetRepository.Object);

        await worker.SyncOnceAsync();

        repository.Verify(
            repo => repo.AddReadingsAsync(
                It.Is<IEnumerable<WeatherReading>>(readings =>
                    HasExpectedReading(readings, 68.1)),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    private static bool HasExpectedReading(IEnumerable<WeatherReading> readings)
    {
        return HasExpectedReading(readings, 72.5);
    }

    private static bool HasExpectedReading(IEnumerable<WeatherReading> readings, double expectedTempF)
    {
        var reading = readings.Single();
        reading.DeviceMacAddress.ShouldBe(WeatherTestData.Mac);
        reading.TempF.ShouldBe(expectedTempF);

        return true;
    }

    private static HistorySyncWorker CreateWorker(
        Mock<IAmbientRestClient> ambientClient,
        IWeatherReadingRepository repository,
        HistorySyncWorkerOptions options,
        IHistorySyncTargetRepository? targetRepository = null)
    {
        var services = new ServiceCollection();
        services.AddSingleton(repository);
        if (targetRepository != null)
        {
            services.AddSingleton(targetRepository);
        }

        return new HistorySyncWorker(
            ambientClient.Object,
            services.BuildServiceProvider(),
            Options.Create(options),
            Mock.Of<ILogger<HistorySyncWorker>>());
    }
}
