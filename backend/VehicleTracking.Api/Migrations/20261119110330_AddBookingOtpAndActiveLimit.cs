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

            // Data fixup required before the unique index below can be
            // created: any real, pre-existing data where a passenger already
            // has more than one Pending/Accepted booking (from before this
            // one-active-booking-at-a-time rule existed) must be resolved
            // first, or CREATE UNIQUE INDEX fails outright on that data.
            // Keep each passenger's single most-recent active booking,
            // Cancel the rest - the same outcome as if the passenger had
            // manually cancelled the older ones.
            migrationBuilder.Sql(@"
                WITH ranked AS (
                    SELECT ""Id"",
                           ROW_NUMBER() OVER (PARTITION BY ""PassengerId"" ORDER BY ""CreatedAt"" DESC) AS rn
                    FROM ""Bookings""
                    WHERE ""Status"" IN ('Pending', 'Accepted')
                )
                UPDATE ""Bookings""
                SET ""Status"" = 'Cancelled', ""RespondedAt"" = NOW()
                WHERE ""Id"" IN (SELECT ""Id"" FROM ranked WHERE rn > 1);
            ");

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
