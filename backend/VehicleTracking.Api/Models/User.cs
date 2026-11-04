namespace VehicleTracking.Api.Models;

public enum UserRole
{
    Passenger,
    Driver,
    Admin
}

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.Passenger;
    public string? PushToken { get; set; }
    public bool IsSuspended { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Vehicle> Vehicles { get; set; } = new List<Vehicle>();
    public ICollection<WatchedVehicle> WatchedVehicles { get; set; } = new List<WatchedVehicle>();
}
