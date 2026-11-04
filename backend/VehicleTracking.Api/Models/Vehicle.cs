namespace VehicleTracking.Api.Models;

public class Vehicle
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string RegistrationNumber { get; set; } = string.Empty;
    public VehicleType Type { get; set; }
    public string? RouteName { get; set; }

    public Guid DriverId { get; set; }
    public User? Driver { get; set; }

    public bool IsActive { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<LocationPing> LocationPings { get; set; } = new List<LocationPing>();
    public ICollection<Trip> Trips { get; set; } = new List<Trip>();
}
