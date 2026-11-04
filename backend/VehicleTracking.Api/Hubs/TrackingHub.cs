using Microsoft.AspNetCore.SignalR;

namespace VehicleTracking.Api.Hubs;

public class VehicleLocationUpdate
{
    public Guid VehicleId { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public double? SpeedKmh { get; set; }
    public double? HeadingDegrees { get; set; }
    public DateTime RecordedAt { get; set; }
}

public class TrackingHub : Hub
{
    private const string PassengersGroup = "passengers";

    public async Task JoinPassengers()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, PassengersGroup);
    }

    public async Task LeavePassengers()
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, PassengersGroup);
    }

    public static string VehicleGroup(Guid vehicleId) => $"vehicle-{vehicleId}";

    public async Task WatchVehicle(Guid vehicleId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, VehicleGroup(vehicleId));
    }

    public async Task UnwatchVehicle(Guid vehicleId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, VehicleGroup(vehicleId));
    }
}
