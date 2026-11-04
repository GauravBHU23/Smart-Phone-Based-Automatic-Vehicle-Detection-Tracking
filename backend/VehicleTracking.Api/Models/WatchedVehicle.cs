namespace VehicleTracking.Api.Models;

public class WatchedVehicle
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }
    public User? User { get; set; }

    public Guid VehicleId { get; set; }
    public Vehicle? Vehicle { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
