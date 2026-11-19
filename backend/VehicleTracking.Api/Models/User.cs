namespace VehicleTracking.Api.Models;

public enum UserRole
{
    Passenger,
    Driver,
    Admin
}

public enum DriverVerificationStatus
{
    NotSubmitted,
    Pending,
    Approved,
    Rejected
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

    public DateTime? DateOfBirth { get; set; }
    public string? ProfilePhotoUrl { get; set; }
    public string? DlPhotoUrl { get; set; }
    public string? AadhaarPhotoUrl { get; set; }
    public string? RcPhotoUrl { get; set; }
    public DriverVerificationStatus VerificationStatus { get; set; } = DriverVerificationStatus.NotSubmitted;
    public string? VerificationRejectionReason { get; set; }
    public DateTime? VerificationSubmittedAt { get; set; }
    public DateTime? VerificationReviewedAt { get; set; }

    public ICollection<Vehicle> Vehicles { get; set; } = new List<Vehicle>();
    public ICollection<WatchedVehicle> WatchedVehicles { get; set; } = new List<WatchedVehicle>();
}
