using VehicleTracking.Api.Models;

namespace VehicleTracking.Api.DTOs;

public record VerificationStatusResponse(
    DriverVerificationStatus Status,
    DateTime? DateOfBirth,
    string? ProfilePhotoUrl,
    string? DlPhotoUrl,
    string? AadhaarPhotoUrl,
    string? RcPhotoUrl,
    string? RejectionReason,
    DateTime? SubmittedAt,
    DateTime? ReviewedAt
);

public record RejectVerificationRequest(string Reason);
