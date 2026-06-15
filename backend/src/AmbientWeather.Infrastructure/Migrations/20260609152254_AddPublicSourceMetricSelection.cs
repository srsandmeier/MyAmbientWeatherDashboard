using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AmbientWeather.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPublicSourceMetricSelection : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "selected_metric_keys_json",
                table: "public_weather_sources",
                type: "jsonb",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "selected_metric_keys_json",
                table: "public_weather_sources");
        }
    }
}
