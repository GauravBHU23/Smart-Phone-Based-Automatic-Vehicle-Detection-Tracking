using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using VehicleTracking.Api.Data;
using VehicleTracking.Api.DTOs;
using VehicleTracking.Api.Hubs;
using VehicleTracking.Api.Models;

namespace VehicleTracking.Api.Controllers;

[ApiController]
[Route("api/vehicles")]
[Authorize]
public class VehiclesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<TrackingHub> _hub;

    public VehiclesController(AppDbContext db, IHubContext<TrackingHub> hub)
    {
        _db = db;
        _hub = hub;
    }

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    [HttpPost]
    [Authorize(Roles = "Driver")]
    public async Task<ActionResult<VehicleResponse>> RegisterVehicle(RegisterVehicleRequest request)
    {
        var vehicle = new Vehicle
        {
            RegistrationNumber = request.RegistrationNumber,
            Type = request.Type,
            RouteName = request.RouteName,
            DriverId = CurrentUserId
        };

        _db.Vehicles.Add(vehicle);
        await _db.SaveChangesAsync();

        return Ok(new VehicleResponse(vehicle.Id, vehicle.RegistrationNumber, vehicle.Type, vehicle.RouteName, vehicle.IsActive));
    }

    [HttpGet("mine")]
    [Authorize(Roles = "Driver")]
    public async Task<ActionResult<List<VehicleResponse>>> GetMyVehicles()
    {
        var vehicles = await _db.Vehicles
            .Where(v => v.DriverId == CurrentUserId)
            .Select(v => new VehicleResponse(v.Id, v.RegistrationNumber, v.Type, v.RouteName, v.IsActive))
            .ToListAsync();

        return Ok(vehicles);
    }

    [HttpPost("{vehicleId:guid}/start")]
    [Authorize(Roles = "Driver")]
    public async Task<IActionResult> StartTracking(Guid vehicleId)
    {
        var vehicle = await _db.Vehicles.SingleOrDefaultAsync(v => v.Id == vehicleId && v.DriverId == CurrentUserId);
        if (vehicle is null) return NotFound();

        vehicle.IsActive = true;
        _db.Trips.Add(new Trip { VehicleId = vehicleId });
        await _db.SaveChangesAsync();

        return NoContent();
    }

    [HttpPost("{vehicleId:guid}/stop")]
    [Authorize(Roles = "Driver")]
    public async Task<IActionResult> StopTracking(Guid vehicleId)
    {
        var vehicle = await _db.Vehicles.SingleOrDefaultAsync(v => v.Id == vehicleId && v.DriverId == CurrentUserId);
        if (vehicle is null) return NotFound();

        vehicle.IsActive = false;

        var openTrip = await _db.Trips
            .Where(t => t.VehicleId == vehicleId && t.EndedAt == null)
            .OrderByDescending(t => t.StartedAt)
            .FirstOrDefaultAsync();
        if (openTrip is not null) openTrip.EndedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        await _hub.Clients.Group("passengers").SendAsync("VehicleStopped", vehicleId);
        await _hub.Clients.Group(TrackingHub.VehicleGroup(vehicleId)).SendAsync("VehicleStopped", vehicleId);

        return NoContent();
    }

    [HttpPost("{vehicleId:guid}/location")]
    [Authorize(Roles = "Driver")]
    public async Task<IActionResult> PostLocation(Guid vehicleId, LocationPingRequest request)
    {
        var vehicle = await _db.Vehicles.SingleOrDefaultAsync(v => v.Id == vehicleId && v.DriverId == CurrentUserId);
        if (vehicle is null) return NotFound();

        var ping = new LocationPing
        {
            VehicleId = vehicleId,
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            SpeedKmh = request.SpeedKmh,
            HeadingDegrees = request.HeadingDegrees,
            AccuracyMeters = request.AccuracyMeters
        };

        _db.LocationPings.Add(ping);
        await _db.SaveChangesAsync();

        var update = new VehicleLocationUpdate
        {
            VehicleId = vehicleId,
            Latitude = ping.Latitude,
            Longitude = ping.Longitude,
            SpeedKmh = ping.SpeedKmh,
            HeadingDegrees = ping.HeadingDegrees,
            RecordedAt = ping.RecordedAt
        };

        await _hub.Clients.Group("passengers").SendAsync("VehicleLocationUpdated", update);
        await _hub.Clients.Group(TrackingHub.VehicleGroup(vehicleId)).SendAsync("VehicleLocationUpdated", update);

        return NoContent();
    }

    [HttpGet("active")]
    [AllowAnonymous]
    public async Task<ActionResult<List<VehicleWithLocationResponse>>> GetActiveVehicles([FromQuery] VehicleType? type)
    {
        var query = _db.Vehicles.Where(v => v.IsActive);
        if (type.HasValue) query = query.Where(v => v.Type == type);

        var vehicles = await query
            .Select(v => new
            {
                v.Id,
                v.RegistrationNumber,
                v.Type,
                v.RouteName,
                LastPing = v.LocationPings.OrderByDescending(p => p.RecordedAt).FirstOrDefault()
            })
            .ToListAsync();

        var result = vehicles.Select(v => new VehicleWithLocationResponse(
            v.Id,
            v.RegistrationNumber,
            v.Type,
            v.RouteName,
            v.LastPing?.Latitude,
            v.LastPing?.Longitude,
            v.LastPing?.SpeedKmh,
            v.LastPing?.RecordedAt
        )).ToList();

        return Ok(result);
    }
}
