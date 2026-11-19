using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VehicleTracking.Api.Migrations
{
    /// <inheritdoc />
    public partial class FixIncompletePendingVerifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // A now-fixed bug in DriverVerificationController let an empty
            // submission (no documents, no date of birth) flip a driver
            // straight to Pending. Reset any account still stuck in that
            // state back to NotSubmitted so they can submit cleanly and
            // admins don't see phantom entries with nothing to review.
            migrationBuilder.Sql(@"
                UPDATE ""Users""
                SET ""VerificationStatus"" = 'NotSubmitted', ""VerificationSubmittedAt"" = NULL
                WHERE ""VerificationStatus"" = 'Pending'
                  AND (""ProfilePhotoUrl"" IS NULL OR ""DlPhotoUrl"" IS NULL OR ""AadhaarPhotoUrl"" IS NULL
                       OR ""RcPhotoUrl"" IS NULL OR ""DateOfBirth"" IS NULL);
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Data-only fixup; not reversible (the original Pending state
            // was a bug, not data worth restoring).
        }
    }
}
