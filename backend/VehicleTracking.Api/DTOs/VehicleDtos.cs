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

public record UpdateVehicleRequest(
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

/// <summary>
/// A place found via an external geocoder (OpenStreetMap Nominatim) that
/// isn't in our own Place directory yet — no Id, since nothing has been
/// persisted. The client passes Name/Latitude/Longitude straight through
/// to vehicle registration or booking, where FindOrCreatePlace inserts it
/// into the directory the first time it's actually used, exactly like a
/// freely-typed new place already works.
/// </summary>
public record ExternalPlaceDto(string Name, double Latitude, double Longitude);

public record PlaceSearchResponse(List<PlaceDto> KnownPlaces, List<ExternalPlaceDto> SuggestedPlaces);

public record ResolvePlaceRequest(string Name, double? Latitude, double? Longitude);

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
