using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AmbientWeather.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    auth_provider_sub = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "weather_readings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DeviceMacAddress = table.Column<string>(type: "character varying(17)", maxLength: 17, nullable: false),
                    DateUtc = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    TempInF = table.Column<double>(type: "double precision", precision: 5, scale: 2, nullable: true),
                    TempF = table.Column<double>(type: "double precision", precision: 5, scale: 2, nullable: true),
                    FeelsLike = table.Column<double>(type: "double precision", precision: 5, scale: 2, nullable: true),
                    FeelsLikeIn = table.Column<double>(type: "double precision", precision: 5, scale: 2, nullable: true),
                    HumidityIn = table.Column<int>(type: "integer", nullable: true),
                    Humidity = table.Column<int>(type: "integer", nullable: true),
                    DewPoint = table.Column<double>(type: "double precision", precision: 5, scale: 2, nullable: true),
                    DewPointIn = table.Column<double>(type: "double precision", precision: 5, scale: 2, nullable: true),
                    BaromRelIn = table.Column<double>(type: "double precision", precision: 6, scale: 3, nullable: true),
                    BaromAbsIn = table.Column<double>(type: "double precision", precision: 6, scale: 3, nullable: true),
                    WindDir = table.Column<int>(type: "integer", nullable: true),
                    WindSpeedMph = table.Column<double>(type: "double precision", precision: 6, scale: 2, nullable: true),
                    WindGustMph = table.Column<double>(type: "double precision", precision: 6, scale: 2, nullable: true),
                    MaxDailyGust = table.Column<double>(type: "double precision", precision: 6, scale: 2, nullable: true),
                    HourlyRainIn = table.Column<double>(type: "double precision", precision: 5, scale: 3, nullable: true),
                    EventRainIn = table.Column<double>(type: "double precision", precision: 5, scale: 3, nullable: true),
                    DailyRainIn = table.Column<double>(type: "double precision", precision: 6, scale: 3, nullable: true),
                    WeeklyRainIn = table.Column<double>(type: "double precision", precision: 6, scale: 3, nullable: true),
                    MonthlyRainIn = table.Column<double>(type: "double precision", precision: 6, scale: 3, nullable: true),
                    TotalRainIn = table.Column<double>(type: "double precision", precision: 8, scale: 3, nullable: true),
                    SolarRadiation = table.Column<double>(type: "double precision", precision: 8, scale: 2, nullable: true),
                    Uv = table.Column<int>(type: "integer", nullable: true),
                    BattOut = table.Column<int>(type: "integer", nullable: true),
                    Tz = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    LastRain = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Date = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    StoredAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_weather_readings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "dashboard_layouts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    layout_json = table.Column<string>(type: "jsonb", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_dashboard_layouts", x => x.id);
                    table.ForeignKey(
                        name: "FK_dashboard_layouts_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_ambient_credentials",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    api_key_encrypted = table.Column<string>(type: "text", nullable: false),
                    application_key_encrypted = table.Column<string>(type: "text", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_ambient_credentials", x => x.user_id);
                    table.ForeignKey(
                        name: "FK_user_ambient_credentials_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_preferences",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    temperature_unit = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    speed_unit = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    pressure_unit = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    rainfall_unit = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    theme = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    neighbour_config_json = table.Column<string>(type: "jsonb", nullable: false),
                    default_weather_station_id = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_preferences", x => x.user_id);
                    table.ForeignKey(
                        name: "FK_user_preferences_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "weather_stations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    mac_address = table.Column<string>(type: "character varying(17)", maxLength: 17, nullable: false),
                    name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    nickname = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    latitude = table.Column<double>(type: "double precision", nullable: true),
                    longitude = table.Column<double>(type: "double precision", nullable: true),
                    elevation_m = table.Column<double>(type: "double precision", nullable: true),
                    is_primary = table.Column<bool>(type: "boolean", nullable: false),
                    display_on_dashboard = table.Column<bool>(type: "boolean", nullable: false),
                    selected_metric_keys_json = table.Column<string>(type: "jsonb", nullable: true),
                    last_sync_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_weather_stations", x => x.id);
                    table.ForeignKey(
                        name: "FK_weather_stations_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "neighbour_station_cache",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    station_id = table.Column<Guid>(type: "uuid", nullable: false),
                    distance_miles = table.Column<double>(type: "double precision", nullable: false),
                    rank = table.Column<short>(type: "smallint", nullable: false),
                    fetched_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_neighbour_station_cache", x => new { x.user_id, x.station_id });
                    table.ForeignKey(
                        name: "FK_neighbour_station_cache_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_neighbour_station_cache_weather_stations_station_id",
                        column: x => x.station_id,
                        principalTable: "weather_stations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_dashboard_layouts_user_id_is_active",
                table: "dashboard_layouts",
                columns: new[] { "user_id", "is_active" });

            migrationBuilder.CreateIndex(
                name: "IX_dashboard_layouts_user_id_name",
                table: "dashboard_layouts",
                columns: new[] { "user_id", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_neighbour_station_cache_station_id",
                table: "neighbour_station_cache",
                column: "station_id");

            migrationBuilder.CreateIndex(
                name: "IX_neighbour_station_cache_user_id_rank",
                table: "neighbour_station_cache",
                columns: new[] { "user_id", "rank" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_auth_provider_sub",
                table: "users",
                column: "auth_provider_sub",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_weather_readings_CreatedAtUtc",
                table: "weather_readings",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_weather_readings_DeviceMacAddress_CreatedAtUtc",
                table: "weather_readings",
                columns: new[] { "DeviceMacAddress", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_weather_readings_DeviceMacAddress_DateUtc",
                table: "weather_readings",
                columns: new[] { "DeviceMacAddress", "DateUtc" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_weather_stations_user_id_mac_address",
                table: "weather_stations",
                columns: new[] { "user_id", "mac_address" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "dashboard_layouts");

            migrationBuilder.DropTable(
                name: "neighbour_station_cache");

            migrationBuilder.DropTable(
                name: "user_ambient_credentials");

            migrationBuilder.DropTable(
                name: "user_preferences");

            migrationBuilder.DropTable(
                name: "weather_readings");

            migrationBuilder.DropTable(
                name: "weather_stations");

            migrationBuilder.DropTable(
                name: "users");
        }
    }
}
