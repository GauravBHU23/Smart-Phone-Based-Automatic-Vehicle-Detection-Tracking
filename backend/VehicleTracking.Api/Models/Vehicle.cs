namespace VehicleTracking.Api.Models;

public class Vehicle
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string RegistrationNumber { get; set; } = string.Empty;
    public VehicleType Type { get; set; }

    // Kept for backwards compatibility with existing data; prefer FromLocation/ToLocation.
    public string? RouteName { get; set; }

    public string? FromLocation { get; set; }
    public string? ToLocation { get; set; }
    public double? DestinationLatitude { get; set; }
    public double? DestinationLongitude { get; set; }

    public Guid DriverId { get; set; }
    public User? Driver { get; set; }

    public bool IsActive { get; set; } = false;
    public bool IsSuspended { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<LocationPing> LocationPings { get; set; } = new List<LocationPing>();
    public ICollection<Trip> Trips { get; set; } = new List<Trip>();
    public ICollection<RouteStop> Stops { get; set; } = new List<RouteStop>();
}
