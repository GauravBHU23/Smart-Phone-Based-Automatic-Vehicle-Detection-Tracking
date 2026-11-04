namespace VehicleTracking.Api.Models;

public class LocationPing
{
    public long Id { get; set; }
    public Guid VehicleId { get; set; }
    public Vehicle? Vehicle { get; set; }

    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public double? SpeedKmh { get; set; }
    public double? HeadingDegrees { get; set; }
    public double? AccuracyMeters { get; set; }

    public DateTime RecordedAt { get; set; } = DateTime.UtcNow;
}
