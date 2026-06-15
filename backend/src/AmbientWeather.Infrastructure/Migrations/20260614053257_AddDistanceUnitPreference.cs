using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AmbientWeather.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDistanceUnitPreference : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "distance_unit",
                table: "user_preferences",
                type: "character varying(8)",
                maxLength: 8,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "distance_unit",
                table: "user_preferences");
        }
    }
}
