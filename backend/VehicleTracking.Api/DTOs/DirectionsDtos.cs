namespace VehicleTracking.Api.DTOs;

public record LatLngDto(double Lat, double Lng);

public record DirectionsResponse(List<LatLngDto> Polyline, double DistanceKm, int EtaMinutes);
