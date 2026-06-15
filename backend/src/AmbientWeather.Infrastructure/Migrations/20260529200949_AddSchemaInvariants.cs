using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AmbientWeather.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSchemaInvariants : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_dashboard_layouts_user_id_is_active",
                table: "dashboard_layouts");

            migrationBuilder.CreateIndex(
                name: "ix_weather_stations_user_primary",
                table: "weather_stations",
                column: "user_id",
                unique: true,
                filter: "is_primary = true");

            migrationBuilder.CreateIndex(
                name: "IX_user_preferences_default_weather_station_id",
                table: "user_preferences",
                column: "default_weather_station_id");

            migrationBuilder.CreateIndex(
                name: "ix_dashboard_layouts_user_active",
                table: "dashboard_layouts",
                column: "user_id",
                unique: true,
                filter: "is_active = true");

            migrationBuilder.AddForeignKey(
                name: "FK_user_preferences_weather_stations_default_weather_station_id",
                table: "user_preferences",
                column: "default_weather_station_id",
                principalTable: "weather_stations",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_user_preferences_weather_stations_default_weather_station_id",
                table: "user_preferences");

            migrationBuilder.DropIndex(
                name: "ix_weather_stations_user_primary",
                table: "weather_stations");

            migrationBuilder.DropIndex(
                name: "IX_user_preferences_default_weather_station_id",
                table: "user_preferences");

            migrationBuilder.DropIndex(
                name: "ix_dashboard_layouts_user_active",
                table: "dashboard_layouts");

            migrationBuilder.CreateIndex(
                name: "IX_dashboard_layouts_user_id_is_active",
                table: "dashboard_layouts",
                columns: new[] { "user_id", "is_active" });
        }
    }
}
