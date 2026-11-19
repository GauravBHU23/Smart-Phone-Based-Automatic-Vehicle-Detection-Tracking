using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VehicleTracking.Api.Data;
using VehicleTracking.Api.DTOs;
using VehicleTracking.Api.Models;
using VehicleTracking.Api.Services;

namespace VehicleTracking.Api.Controllers;

[ApiController]
[Route("api/driver/verification")]
[Authorize(Roles = "Driver")]
public class DriverVerificationController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly CloudinaryService _cloudinary;

    public DriverVerificationController(AppDbContext db, CloudinaryService cloudinary)
    {
        _db = db;
        _cloudinary = cloudinary;
    }

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    private static VerificationStatusResponse ToResponse(User u) => new(
        u.VerificationStatus,
        u.DateOfBirth,
        u.ProfilePhotoUrl,
        u.DlPhotoUrl,
        u.AadhaarPhotoUrl,
        u.RcPhotoUrl,
        u.VerificationRejectionReason,
        u.VerificationSubmittedAt,
        u.VerificationReviewedAt
    );

    [HttpGet("status")]
    public async Task<ActionResult<VerificationStatusResponse>> GetStatus()
    {
        var driver = await _db.Users.SingleAsync(u => u.Id == CurrentUserId);
        await SelfHealIncompletePendingAsync(driver);
        return Ok(ToResponse(driver));
    }

    // A now-fixed bug briefly let an empty submission flip a driver straight
    // to Pending with none of the required documents actually on file.
    // Self-heals any account still stuck in that state back to NotSubmitted
    // so the driver can submit cleanly, rather than leaving them stranded
    // on a Pending review an admin can never meaningfully act on.
    private async Task SelfHealIncompletePendingAsync(User driver)
    {
        if (driver.VerificationStatus != DriverVerificationStatus.Pending) return;
        var complete = driver.ProfilePhotoUrl is not null && driver.DlPhotoUrl is not null &&
            driver.AadhaarPhotoUrl is not null && driver.RcPhotoUrl is not null && driver.DateOfBirth is not null;
        if (complete) return;

        driver.VerificationStatus = DriverVerificationStatus.NotSubmitted;
        driver.VerificationSubmittedAt = null;
        await _db.SaveChangesAsync();
    }

    [HttpPost("documents")]
    [RequestSizeLimit(20_000_000)]
    public async Task<ActionResult<VerificationStatusResponse>> SubmitDocuments(
        [FromForm] DateTime? dateOfBirth,
        [FromForm] IFormFile? profilePhoto,
        [FromForm] IFormFile? dlPhoto,
        [FromForm] IFormFile? aadhaarPhoto,
        [FromForm] IFormFile? rcPhoto)
    {
        var driver = await _db.Users.SingleAsync(u => u.Id == CurrentUserId);

        // A resubmission after rejection only needs to replace whichever
        // documents the admin flagged - whatever isn't resent this time
        // keeps its previously-uploaded URL. If a file WAS sent but the
        // Cloudinary upload itself failed, that must surface as an error,
        // not silently fall back to whatever URL (or lack of one) existed
        // before - otherwise a driver could believe they submitted a
        // document that never actually made it to storage.
        var uploadFailures = new List<string>();

        if (profilePhoto is { Length: > 0 })
        {
            var url = await UploadOrNullAsync(profilePhoto, "driver-verification/profile");
            if (url is not null) driver.ProfilePhotoUrl = url;
            else uploadFailures.Add("profile photo");
        }
        if (dlPhoto is { Length: > 0 })
        {
            var url = await UploadOrNullAsync(dlPhoto, "driver-verification/dl");
            if (url is not null) driver.DlPhotoUrl = url;
            else uploadFailures.Add("driving license photo");
        }
        if (aadhaarPhoto is { Length: > 0 })
        {
            var url = await UploadOrNullAsync(aadhaarPhoto, "driver-verification/aadhaar");
            if (url is not null) driver.AadhaarPhotoUrl = url;
            else uploadFailures.Add("Aadhaar photo");
        }
        if (rcPhoto is { Length: > 0 })
        {
            var url = await UploadOrNullAsync(rcPhoto, "driver-verification/rc");
            if (url is not null) driver.RcPhotoUrl = url;
            else uploadFailures.Add("RC certificate photo");
        }

        if (uploadFailures.Count > 0)
            return BadRequest($"Could not upload: {string.Join(", ", uploadFailures)}. Please try again.");
        if (dateOfBirth is not null)
        {
            // Npgsql requires DateTime.Kind == Utc for a timestamptz column;
            // model binding from a plain "YYYY-MM-DD" form field produces
            // Kind=Unspecified, which Npgsql rejects outright.
            driver.DateOfBirth = DateTime.SpecifyKind(dateOfBirth.Value, DateTimeKind.Utc);
        }

        // Only actually submit for review once every required piece is
        // present - either uploaded just now or already on file from an
        // earlier submission (a resubmission after rejection only needs to
        // replace the flagged documents, not re-send everything). An empty
        // or partial request must never flip the driver to Pending.
        var missing = new List<string>();
        if (driver.ProfilePhotoUrl is null) missing.Add("profile photo");
        if (driver.DlPhotoUrl is null) missing.Add("driving license photo");
        if (driver.AadhaarPhotoUrl is null) missing.Add("Aadhaar photo");
        if (driver.RcPhotoUrl is null) missing.Add("RC certificate photo");
        if (driver.DateOfBirth is null) missing.Add("date of birth");

        if (missing.Count > 0)
            return BadRequest($"Missing: {string.Join(", ", missing)}.");

        driver.VerificationStatus = DriverVerificationStatus.Pending;
        driver.VerificationSubmittedAt = DateTime.UtcNow;
        driver.VerificationRejectionReason = null;

        await _db.SaveChangesAsync();

        return Ok(ToResponse(driver));
    }

    private async Task<string?> UploadOrNullAsync(IFormFile file, string folder)
    {
        await using var stream = file.OpenReadStream();
        return await _cloudinary.UploadAsync(stream, file.FileName, folder);
    }
}
