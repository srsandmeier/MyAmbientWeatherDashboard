using AmbientWeather.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AmbientWeather.Infrastructure.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AmbientWeatherDbContext))]
    [Migration("20260530161000_AddDateFormatPreference")]
    public partial class AddDateFormatPreference : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "date_format",
                table: "user_preferences",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "mdy");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "date_format",
                table: "user_preferences");
        }
    }
}
