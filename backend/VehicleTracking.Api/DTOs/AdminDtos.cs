using VehicleTracking.Api.Models;

namespace VehicleTracking.Api.DTOs;

public record AdminDriverResponse(
    Guid Id,
    string Name,
    string Phone,
    bool IsSuspended,
    DateTime CreatedAt,
    int VehicleCount
);

public record AdminVehicleResponse(
    Guid Id,
    string RegistrationNumber,
    VehicleType Type,
    string DriverName,
    Guid DriverId,
    bool IsActive,
    bool IsSuspended,
    string? FromLocation,
    string? ToLocation,
    DateTime CreatedAt
);

public record AdminStatsResponse(
    int TotalDrivers,
    int TotalPassengers,
    int TotalVehicles,
    int ActiveVehiclesNow,
    int SuspendedDrivers,
    int SuspendedVehicles,
    int TripsToday,
    int TripsAllTime,
    int TotalBookings,
    int PendingBookings,
    int CompletedRides
);
