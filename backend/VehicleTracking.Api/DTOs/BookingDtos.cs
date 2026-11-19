using VehicleTracking.Api.Models;

namespace VehicleTracking.Api.DTOs;

public record CreateBookingRequest(string? FromLocation, string? ToLocation, string? Note);

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
    string? Note,
    DateTime CreatedAt,
    DateTime? RespondedAt
);
