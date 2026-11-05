using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VehicleTracking.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPlaceDirectory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "FromPlaceId",
                table: "Vehicles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ToPlaceId",
                table: "Vehicles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PlaceId",
                table: "RouteStops",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Places",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Latitude = table.Column<double>(type: "double precision", nullable: true),
                    Longitude = table.Column<double>(type: "double precision", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Places", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Vehicles_FromPlaceId",
                table: "Vehicles",
                column: "FromPlaceId");

            migrationBuilder.CreateIndex(
                name: "IX_Vehicles_ToPlaceId",
                table: "Vehicles",
                column: "ToPlaceId");

            migrationBuilder.CreateIndex(
                name: "IX_RouteStops_PlaceId",
                table: "RouteStops",
                column: "PlaceId");

            migrationBuilder.CreateIndex(
                name: "IX_Places_Code",
                table: "Places",
                column: "Code",
                unique: true);

            // Case-insensitive uniqueness on Name: a plain unique index on Name
            // would let "Civil Lines" and "civil lines" both be inserted as
            // separate rows. This Postgres expression index is what
            // FindOrCreatePlace's race-safety (catch DbUpdateException, re-read)
            // actually relies on.
            migrationBuilder.Sql(
                "CREATE UNIQUE INDEX \"IX_Places_Name_Lower\" ON \"Places\" (LOWER(\"Name\"));");

            migrationBuilder.AddForeignKey(
                name: "FK_RouteStops_Places_PlaceId",
                table: "RouteStops",
                column: "PlaceId",
                principalTable: "Places",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Vehicles_Places_FromPlaceId",
                table: "Vehicles",
                column: "FromPlaceId",
                principalTable: "Places",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Vehicles_Places_ToPlaceId",
                table: "Vehicles",
                column: "ToPlaceId",
                principalTable: "Places",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS \"IX_Places_Name_Lower\";");

            migrationBuilder.DropForeignKey(
                name: "FK_RouteStops_Places_PlaceId",
                table: "RouteStops");

            migrationBuilder.DropForeignKey(
                name: "FK_Vehicles_Places_FromPlaceId",
                table: "Vehicles");

            migrationBuilder.DropForeignKey(
                name: "FK_Vehicles_Places_ToPlaceId",
                table: "Vehicles");

            migrationBuilder.DropTable(
                name: "Places");

            migrationBuilder.DropIndex(
                name: "IX_Vehicles_FromPlaceId",
                table: "Vehicles");

            migrationBuilder.DropIndex(
                name: "IX_Vehicles_ToPlaceId",
                table: "Vehicles");

            migrationBuilder.DropIndex(
                name: "IX_RouteStops_PlaceId",
                table: "RouteStops");

            migrationBuilder.DropColumn(
                name: "FromPlaceId",
                table: "Vehicles");

            migrationBuilder.DropColumn(
                name: "ToPlaceId",
                table: "Vehicles");

            migrationBuilder.DropColumn(
                name: "PlaceId",
                table: "RouteStops");
        }
    }
}
