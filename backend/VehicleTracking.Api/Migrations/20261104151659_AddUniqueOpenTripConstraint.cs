using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VehicleTracking.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUniqueOpenTripConstraint : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Trips_VehicleId",
                table: "Trips");

            // Pre-existing data may have multiple open trips per vehicle (e.g. from
            // duplicate Start calls before this constraint existed). Close every
            // open trip except the most recently started one per vehicle, so the
            // unique index below can be created without failing.
            migrationBuilder.Sql(@"
                UPDATE ""Trips"" t
                SET ""EndedAt"" = NOW()
                WHERE t.""EndedAt"" IS NULL
                  AND t.""Id"" <> (
                      SELECT t2.""Id"" FROM ""Trips"" t2
                      WHERE t2.""VehicleId"" = t.""VehicleId"" AND t2.""EndedAt"" IS NULL
                      ORDER BY t2.""StartedAt"" DESC
                      LIMIT 1
                  );
            ");

            migrationBuilder.CreateIndex(
                name: "IX_Trips_VehicleId_OpenTrip",
                table: "Trips",
                column: "VehicleId",
                unique: true,
                filter: "\"EndedAt\" IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Trips_VehicleId_OpenTrip",
                table: "Trips");

            migrationBuilder.CreateIndex(
                name: "IX_Trips_VehicleId",
                table: "Trips",
                column: "VehicleId");
        }
    }
}
