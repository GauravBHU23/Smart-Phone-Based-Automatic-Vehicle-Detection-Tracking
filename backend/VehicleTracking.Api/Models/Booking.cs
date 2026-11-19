namespace VehicleTracking.Api.Models;

public enum BookingStatus
{
    Pending,
    Accepted,
    Rejected,
    Cancelled,
    Completed
}

public class Booking
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid VehicleId { get; set; }
    public Vehicle? Vehicle { get; set; }

    public Guid PassengerId { get; set; }
    public User? Passenger { get; set; }

    public BookingStatus Status { get; set; } = BookingStatus.Pending;

    public string? FromLocation { get; set; }
    public string? ToLocation { get; set; }
    public double? FromLatitude { get; set; }
    public double? FromLongitude { get; set; }
    public string? Note { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? RespondedAt { get; set; }
}
