using System.Text.Json;
using AmbientWeather.Application.Common;
using AmbientWeather.Application.DTOs.Dashboard;
using AmbientWeather.Application.Interfaces;
using AmbientWeather.Domain.Entities;
using AmbientWeather.Domain.Metrics;
using MediatR;

namespace AmbientWeather.Application.Features.Dashboard.Queries;

/// <summary>
/// Handler for <see cref="GetDashboardLayoutQuery"/>.
/// Returns the user's active layout; seeds a suggested default on first access.
/// The seed includes metric tiles for the primary station (if one is configured)
/// plus a status tile and a rainfall tile.
/// </summary>
internal sealed class GetDashboardLayoutQueryHandler
    : IRequestHandler<GetDashboardLayoutQuery, DashboardLayoutDto>
{
    private readonly ICurrentUserService _currentUserService;
    private readonly IDashboardLayoutStore _layoutStore;
    private readonly IUserStationStore _stationStore;

    /// <summary>Initializes the handler.</summary>
    public GetDashboardLayoutQueryHandler(
        ICurrentUserService currentUserService,
        IDashboardLayoutStore layoutStore,
        IUserStationStore stationStore)
    {
        _currentUserService = currentUserService;
        _layoutStore = layoutStore;
        _stationStore = stationStore;
    }

    /// <inheritdoc />
    public async Task<DashboardLayoutDto> Handle(
        GetDashboardLayoutQuery request,
        CancellationToken cancellationToken)
    {
        var subject = _currentUserService.RequireAuthenticatedUser();

        var active = await _layoutStore.GetActiveAsync(subject, cancellationToken)
            .ConfigureAwait(false);

        if (active is not null)
        {
            var payload = DeserializeLayoutPayload(active.LayoutJson);
            if (payload is not null)
            {
                return new DashboardLayoutDto
                {
                    Id = active.Id,
                    Name = active.Name,
                    LayoutMode = payload.LayoutMode,
                    Tiles = payload.Tiles,
                    CustomItems = payload.CustomItems,
                    UpdatedAtUtc = active.UpdatedAtUtc,
                };
            }
            // Malformed stored JSON — fall through to reseed the default layout.
        }

        // No active layout — seed a default.
        var station = await _stationStore
            .GetDefaultStationAsync(subject, cancellationToken)
            .ConfigureAwait(false);

        var defaultTiles = BuildDefaultTiles(station);
        var defaultPayload = new DashboardLayoutPayloadDto
        {
            LayoutMode = "default",
            Tiles = defaultTiles,
            CustomItems = [],
        };
        var defaultJson = JsonSerializer.Serialize(defaultPayload, DashboardLayoutSerializationOptions.Instance);

        var seeded = await _layoutStore.UpsertActiveAsync(subject, defaultJson, cancellationToken)
            .ConfigureAwait(false);

        return new DashboardLayoutDto
        {
            Id = seeded.Id,
            Name = seeded.Name,
            LayoutMode = "default",
            Tiles = defaultTiles,
            CustomItems = [],
            UpdatedAtUtc = seeded.UpdatedAtUtc,
        };
    }

    private static DashboardLayoutPayloadDto? DeserializeLayoutPayload(string layoutJson)
    {
        try
        {
            using var document = JsonDocument.Parse(layoutJson);
            if (document.RootElement.ValueKind == JsonValueKind.Array)
            {
                var tiles = JsonSerializer.Deserialize<IReadOnlyList<DashboardTileDto>>(
                    layoutJson, DashboardLayoutSerializationOptions.Instance) ?? [];
                return new DashboardLayoutPayloadDto
                {
                    LayoutMode = "default",
                    Tiles = tiles,
                    CustomItems = [],
                };
            }

            var payload = JsonSerializer.Deserialize<DashboardLayoutPayloadDto>(
                layoutJson, DashboardLayoutSerializationOptions.Instance) ?? new DashboardLayoutPayloadDto();
            // Coalesce an explicitly-null layoutMode (e.g. from a corrupted row) to "default".
            return payload with { LayoutMode = payload.LayoutMode ?? "default" };
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static readonly IReadOnlyList<string> TemperatureMetrics =
        [
            "outdoor_temp", "feels_like", "dew_point",
            "daily_high_temp", "daily_low_temp",
            "indoor_temp", "indoor_feels_like", "indoor_dew_point",
            "daily_high_temp_in", "daily_low_temp_in",
        ];

    private static readonly IReadOnlyList<string> HumidityMetrics =
        ["outdoor_humidity", "indoor_humidity"];

    private static readonly IReadOnlyList<string> WindMetrics =
        ["wind_dir", "wind_speed", "wind_gust", "max_daily_gust"];

    private static readonly IReadOnlyList<string> RainfallMetrics =
        ["rainfall_event", "rainfall_day", "rainfall_week", "rainfall_month", "rainfall_year"];

    private static readonly IReadOnlyList<string> SolarMetrics =
        ["solar_radiation", "uv_index"];

    private static readonly IReadOnlyList<string> ConditionsMetrics =
        ["nws_sky_conditions", "nws_present_weather", "nws_text_description", "nws_raw_metar"];

    private static readonly IReadOnlyList<string> IndividualMetrics =
        ["pressure"];

    private static List<DashboardTileDto> BuildDefaultTiles(WeatherStation? station)
    {
        var tiles = new List<DashboardTileDto>();

        if (station is null || string.IsNullOrWhiteSpace(station.MacAddress))
        {
            tiles.Add(new() { I = "rainfall", X = 0, Y = 0, W = 4, H = 4, Type = "rainfall" });
            return tiles;
        }

        var mac = station.MacAddress.ToUpperInvariant().Replace(":", string.Empty);
        var selectedKeys = new HashSet<string>(
            DeserializeMetricKeys(station.SelectedMetricKeysJson)
                ?? TemperatureMetrics.Concat(HumidityMetrics).Concat(WindMetrics).Concat(SolarMetrics),
            StringComparer.OrdinalIgnoreCase);

        var col = 0;
        var row = 0;
        var rowMaxH = 0;

        void AddGroupTile(string type, int w, int h)
        {
            tiles.Add(new() { I = $"{type}-{mac}", X = col, Y = row, W = w, H = h, Type = type, DeviceId = mac });
            rowMaxH = Math.Max(rowMaxH, h);
            col += w;
            if (col >= 12) { col = 0; row += rowMaxH; rowMaxH = 0; }
        }

        if (selectedKeys.Overlaps(TemperatureMetrics)) AddGroupTile("temperature", 3, 5);
        if (selectedKeys.Overlaps(HumidityMetrics)) AddGroupTile("humidity", 2, 3);
        if (selectedKeys.Overlaps(WindMetrics)) AddGroupTile("wind", 2, 4);
        if (selectedKeys.Overlaps(SolarMetrics)) AddGroupTile("solar", 2, 3);
        if (selectedKeys.Overlaps(ConditionsMetrics)) AddGroupTile("conditions", 3, 4);

        // Rainfall always on its own row.
        var rainfallY = tiles.Count > 0 ? tiles.Max(t => t.Y + t.H) : 0;
        tiles.Add(new() { I = "rainfall", X = 0, Y = rainfallY, W = 4, H = 4, Type = "rainfall" });

        // Individual metrics (pressure, UV, solar) beside rainfall.
        var indCol = 4;
        foreach (var key in IndividualMetrics.Where(k => selectedKeys.Contains(k)))
        {
            tiles.Add(new() { I = $"{key}-{mac}", X = indCol, Y = rainfallY, W = 2, H = 4, Type = "metric", MetricKey = key, DeviceId = mac });
            indCol += 2;
        }

        return tiles;
    }

    private static IReadOnlyList<string>? DeserializeMetricKeys(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            return JsonSerializer.Deserialize<IReadOnlyList<string>>(json);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
