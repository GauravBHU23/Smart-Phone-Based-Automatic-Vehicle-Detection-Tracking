using VehicleTracking.Api.Models;

namespace VehicleTracking.Api.DTOs;

public record RegisterVehicleRequest(string RegistrationNumber, VehicleType Type, string? RouteName);

public record VehicleResponse(Guid Id, string RegistrationNumber, VehicleType Type, string? RouteName, bool IsActive);

public record LocationPingRequest(double Latitude, double Longitude, double? SpeedKmh, double? HeadingDegrees, double? AccuracyMeters);

public record VehicleWithLocationResponse(
    Guid Id,
    string RegistrationNumber,
    VehicleType Type,
    string? RouteName,
    double? Latitude,
    double? Longitude,
    double? SpeedKmh,
    DateTime? LastUpdatedAt
);
