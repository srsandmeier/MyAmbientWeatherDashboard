using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AmbientWeather.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddNeighborSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "neighbour_station_cache");

            migrationBuilder.RenameColumn(
                name: "neighbour_config_json",
                table: "user_preferences",
                newName: "neighbor_config_json");

            migrationBuilder.CreateTable(
                name: "neighbor_station_cache",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    provider = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    source_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    lat = table.Column<double>(type: "double precision", nullable: false),
                    lon = table.Column<double>(type: "double precision", nullable: false),
                    distance_miles = table.Column<double>(type: "double precision", nullable: false),
                    last_observed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    freshness_minutes = table.Column<int>(type: "integer", nullable: true),
                    raw_reading_json = table.Column<string>(type: "text", nullable: true),
                    cached_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_neighbor_station_cache", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_neighbor_station_cache_user_hash",
                table: "neighbor_station_cache",
                column: "user_hash");

            migrationBuilder.CreateIndex(
                name: "IX_neighbor_station_cache_user_hash_provider_source_id",
                table: "neighbor_station_cache",
                columns: new[] { "user_hash", "provider", "source_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "neighbor_station_cache");

            migrationBuilder.RenameColumn(
                name: "neighbor_config_json",
                table: "user_preferences",
                newName: "neighbour_config_json");

            migrationBuilder.CreateTable(
                name: "neighbour_station_cache",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    station_id = table.Column<Guid>(type: "uuid", nullable: false),
                    distance_miles = table.Column<double>(type: "double precision", nullable: false),
                    fetched_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    rank = table.Column<short>(type: "smallint", nullable: false)
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
                name: "IX_neighbour_station_cache_station_id",
                table: "neighbour_station_cache",
                column: "station_id");

            migrationBuilder.CreateIndex(
                name: "IX_neighbour_station_cache_user_id_rank",
                table: "neighbour_station_cache",
                columns: new[] { "user_id", "rank" },
                unique: true);
        }
    }
}
