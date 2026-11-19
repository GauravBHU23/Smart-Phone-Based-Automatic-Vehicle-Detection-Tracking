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
        return Ok(ToResponse(driver));
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
        // keeps its previously-uploaded URL.
        if (profilePhoto is { Length: > 0 })
        {
            var url = await UploadOrNullAsync(profilePhoto, "driver-verification/profile");
            if (url is not null) driver.ProfilePhotoUrl = url;
        }
        if (dlPhoto is { Length: > 0 })
        {
            var url = await UploadOrNullAsync(dlPhoto, "driver-verification/dl");
            if (url is not null) driver.DlPhotoUrl = url;
        }
        if (aadhaarPhoto is { Length: > 0 })
        {
            var url = await UploadOrNullAsync(aadhaarPhoto, "driver-verification/aadhaar");
            if (url is not null) driver.AadhaarPhotoUrl = url;
        }
        if (rcPhoto is { Length: > 0 })
        {
            var url = await UploadOrNullAsync(rcPhoto, "driver-verification/rc");
            if (url is not null) driver.RcPhotoUrl = url;
        }
        if (dateOfBirth is not null)
        {
            // Npgsql requires DateTime.Kind == Utc for a timestamptz column;
            // model binding from a plain "YYYY-MM-DD" form field produces
            // Kind=Unspecified, which Npgsql rejects outright.
            driver.DateOfBirth = DateTime.SpecifyKind(dateOfBirth.Value, DateTimeKind.Utc);
        }

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
