namespace VehicleTracking.Api.Models;

public class RouteStop
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid VehicleId { get; set; }
    public Vehicle? Vehicle { get; set; }

    public string Name { get; set; } = string.Empty;
    public int Order { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
}
