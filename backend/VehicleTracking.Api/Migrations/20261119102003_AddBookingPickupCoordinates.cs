using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VehicleTracking.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddBookingPickupCoordinates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "FromLatitude",
                table: "Bookings",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "FromLongitude",
                table: "Bookings",
                type: "double precision",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FromLatitude",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "FromLongitude",
                table: "Bookings");
        }
    }
}
