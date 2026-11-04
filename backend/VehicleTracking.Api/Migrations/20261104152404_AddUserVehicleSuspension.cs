using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VehicleTracking.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUserVehicleSuspension : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsSuspended",
                table: "Vehicles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsSuspended",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsSuspended",
                table: "Vehicles");

            migrationBuilder.DropColumn(
                name: "IsSuspended",
                table: "Users");
        }
    }
}
