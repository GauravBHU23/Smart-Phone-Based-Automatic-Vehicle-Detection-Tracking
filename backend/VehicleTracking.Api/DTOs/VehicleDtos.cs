using VehicleTracking.Api.Models;

namespace VehicleTracking.Api.DTOs;

public record StopInput(string Name, double? Latitude, double? Longitude, Guid? PlaceId);

public record RegisterVehicleRequest(
    string RegistrationNumber,
    VehicleType Type,
    string? FromLocation,
    string? ToLocation,
    double? DestinationLatitude,
    double? DestinationLongitude,
    Guid? FromPlaceId,
    Guid? ToPlaceId,
    List<StopInput>? Stops
);

public record StopDto(string Name, double? Latitude, double? Longitude, bool Reached);

public record VehicleResponse(
    Guid Id,
    string RegistrationNumber,
    VehicleType Type,
    string? FromLocation,
    string? ToLocation,
    double? DestinationLatitude,
    double? DestinationLongitude,
    List<StopDto> Stops,
    bool IsActive
);

public record LocationPingRequest(double Latitude, double Longitude, double? SpeedKmh, double? HeadingDegrees, double? AccuracyMeters);

public record VehicleWithLocationResponse(
    Guid Id,
    string RegistrationNumber,
    VehicleType Type,
    string? FromLocation,
    string? ToLocation,
    double? Latitude,
    double? Longitude,
    double? SpeedKmh,
    DateTime? LastUpdatedAt
);

public record VehicleStatusResponse(
    Guid Id,
    string RegistrationNumber,
    VehicleType Type,
    string DriverName,
    string? FromLocation,
    string? ToLocation,
    double? DestinationLatitude,
    double? DestinationLongitude,
    List<StopDto> Stops,
    bool IsActive,
    double? Latitude,
    double? Longitude,
    double? SpeedKmh,
    DateTime? LastUpdatedAt,
    DateTime? TripStartedAt,
    double? DistanceCoveredKm
);

public record RegisterPushTokenRequest(string PushToken);

public record PlaceDto(Guid Id, string Code, string Name, double? Latitude, double? Longitude);

public record RouteSearchResultResponse(
    Guid Id,
    string RegistrationNumber,
    VehicleType Type,
    string DriverName,
    string? FromLocation,
    string? ToLocation,
    List<StopDto> Stops,
    bool IsActive,
    double? Latitude,
    double? Longitude,
    double? SpeedKmh,
    DateTime? LastUpdatedAt
);
