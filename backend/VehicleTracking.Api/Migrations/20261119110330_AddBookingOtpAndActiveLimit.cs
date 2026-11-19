using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VehicleTracking.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddBookingOtpAndActiveLimit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Bookings_PassengerId",
                table: "Bookings");

            migrationBuilder.AddColumn<string>(
                name: "OtpCode",
                table: "Bookings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "OtpVerifiedAt",
                table: "Bookings",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_PassengerId_Active",
                table: "Bookings",
                column: "PassengerId",
                unique: true,
                filter: "\"Status\" IN ('Pending', 'Accepted')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Bookings_PassengerId_Active",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "OtpCode",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "OtpVerifiedAt",
                table: "Bookings");

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_PassengerId",
                table: "Bookings",
                column: "PassengerId");
        }
    }
}
