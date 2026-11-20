using VehicleTracking.Api.Models;

namespace VehicleTracking.Api.DTOs;

public record CreateBookingRequest(
    string? FromLocation,
    string? ToLocation,
    double? FromLatitude,
    double? FromLongitude,
    double? ToLatitude,
    double? ToLongitude,
    string? Note
);

public record VerifyOtpRequest(string Otp);

public record BookingResponse(
    Guid Id,
    Guid VehicleId,
    string VehicleRegistrationNumber,
    VehicleType VehicleType,
    Guid PassengerId,
    string PassengerName,
    string? PassengerPhone,
    string? DriverPhone,
    BookingStatus Status,
    string? FromLocation,
    string? ToLocation,
    double? FromLatitude,
    double? FromLongitude,
    double? ToLatitude,
    double? ToLongitude,
    string? Note,
    string? OtpCode,
    bool OtpVerified,
    DateTime CreatedAt,
    DateTime? RespondedAt
);
