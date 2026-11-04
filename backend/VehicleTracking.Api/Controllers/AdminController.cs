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
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<TrackingHub> _hub;

    public AdminController(AppDbContext db, IHubContext<TrackingHub> hub)
    {
        _db = db;
        _hub = hub;
    }

    [HttpGet("drivers")]
    public async Task<ActionResult<List<AdminDriverResponse>>> GetDrivers([FromQuery] string? search)
    {
        var query = _db.Users.Where(u => u.Role == UserRole.Driver);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(u => u.Name.Contains(term) || u.Phone.Contains(term));
        }

        var drivers = await query
            .OrderByDescending(u => u.CreatedAt)
            .Select(u => new AdminDriverResponse(
                u.Id,
                u.Name,
                u.Phone,
                u.IsSuspended,
                u.CreatedAt,
                u.Vehicles.Count
            ))
            .ToListAsync();

        return Ok(drivers);
    }

    [HttpGet("vehicles")]
    public async Task<ActionResult<List<AdminVehicleResponse>>> GetVehicles([FromQuery] string? search)
    {
        var query = _db.Vehicles.Include(v => v.Driver).AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(v => v.RegistrationNumber.Contains(term) || (v.Driver != null && v.Driver.Name.Contains(term)));
        }

        var vehicles = await query
            .OrderByDescending(v => v.CreatedAt)
            .Select(v => new AdminVehicleResponse(
                v.Id,
                v.RegistrationNumber,
                v.Type,
                v.Driver != null ? v.Driver.Name : "Unknown",
                v.DriverId,
                v.IsActive,
                v.IsSuspended,
                v.FromLocation,
                v.ToLocation,
                v.CreatedAt
            ))
            .ToListAsync();

        return Ok(vehicles);
    }

    [HttpGet("stats")]
    public async Task<ActionResult<AdminStatsResponse>> GetStats()
    {
        var todayUtc = DateTime.UtcNow.Date;

        var totalDrivers = await _db.Users.CountAsync(u => u.Role == UserRole.Driver);
        var totalPassengers = await _db.Users.CountAsync(u => u.Role == UserRole.Passenger);
        var totalVehicles = await _db.Vehicles.CountAsync();
        var activeVehiclesNow = await _db.Vehicles.CountAsync(v => v.IsActive);
        var suspendedDrivers = await _db.Users.CountAsync(u => u.Role == UserRole.Driver && u.IsSuspended);
        var suspendedVehicles = await _db.Vehicles.CountAsync(v => v.IsSuspended);
        var tripsToday = await _db.Trips.CountAsync(t => t.StartedAt >= todayUtc);
        var tripsAllTime = await _db.Trips.CountAsync();

        return Ok(new AdminStatsResponse(
            totalDrivers,
            totalPassengers,
            totalVehicles,
            activeVehiclesNow,
            suspendedDrivers,
            suspendedVehicles,
            tripsToday,
            tripsAllTime
        ));
    }

    [HttpPost("drivers/{driverId:guid}/suspend")]
    public async Task<IActionResult> SuspendDriver(Guid driverId)
    {
        var driver = await _db.Users.SingleOrDefaultAsync(u => u.Id == driverId && u.Role == UserRole.Driver);
        if (driver is null) return NotFound();

        driver.IsSuspended = true;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("drivers/{driverId:guid}/unsuspend")]
    public async Task<IActionResult> UnsuspendDriver(Guid driverId)
    {
        var driver = await _db.Users.SingleOrDefaultAsync(u => u.Id == driverId && u.Role == UserRole.Driver);
        if (driver is null) return NotFound();

        driver.IsSuspended = false;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("vehicles/{vehicleId:guid}/suspend")]
    public async Task<IActionResult> SuspendVehicle(Guid vehicleId)
    {
        var vehicle = await _db.Vehicles.SingleOrDefaultAsync(v => v.Id == vehicleId);
        if (vehicle is null) return NotFound();

        vehicle.IsSuspended = true;

        // A suspended vehicle must stop appearing as live immediately, not just
        // be blocked from future Start calls — so force-stop any in-progress trip.
        if (vehicle.IsActive)
        {
            vehicle.IsActive = false;
            var openTrip = await _db.Trips
                .Where(t => t.VehicleId == vehicleId && t.EndedAt == null)
                .OrderByDescending(t => t.StartedAt)
                .FirstOrDefaultAsync();
            if (openTrip is not null) openTrip.EndedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();

            await _hub.Clients.Group("passengers").SendAsync("VehicleStopped", vehicleId);
            await _hub.Clients.Group(TrackingHub.VehicleGroup(vehicleId)).SendAsync("VehicleStopped", vehicleId);
        }
        else
        {
            await _db.SaveChangesAsync();
        }

        return NoContent();
    }

    [HttpPost("vehicles/{vehicleId:guid}/unsuspend")]
    public async Task<IActionResult> UnsuspendVehicle(Guid vehicleId)
    {
        var vehicle = await _db.Vehicles.SingleOrDefaultAsync(v => v.Id == vehicleId);
        if (vehicle is null) return NotFound();

        vehicle.IsSuspended = false;
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
