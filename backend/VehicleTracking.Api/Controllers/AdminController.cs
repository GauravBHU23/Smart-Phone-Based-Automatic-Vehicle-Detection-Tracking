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
        var totalBookings = await _db.Bookings.CountAsync();
        var pendingBookings = await _db.Bookings.CountAsync(b => b.Status == BookingStatus.Pending);
        var completedRides = await _db.Bookings.CountAsync(b => b.Status == BookingStatus.Completed);

        return Ok(new AdminStatsResponse(
            totalDrivers,
            totalPassengers,
            totalVehicles,
            activeVehiclesNow,
            suspendedDrivers,
            suspendedVehicles,
            tripsToday,
            tripsAllTime,
            totalBookings,
            pendingBookings,
            completedRides
        ));
    }

    [HttpGet("bookings")]
    public async Task<ActionResult<List<BookingResponse>>> GetBookings([FromQuery] string? search)
    {
        var query = _db.Bookings
            .Include(b => b.Vehicle).ThenInclude(v => v!.Driver)
            .Include(b => b.Passenger)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(b =>
                b.Vehicle!.RegistrationNumber.Contains(term) ||
                b.Passenger!.Name.Contains(term) ||
                b.Passenger!.Phone.Contains(term));
        }

        var bookings = await query
            .OrderByDescending(b => b.CreatedAt)
            .ToListAsync();

        // Admin moderation view: always show both phone numbers regardless of
        // status, unlike the driver/passenger-facing endpoints which only
        // reveal the other party's number once a booking is mutually accepted.
        return Ok(bookings.Select(b => ToBookingResponse(b)).ToList());
    }

    // includeOtp defaults to true since this helper's primary caller is the
    // admin moderation listing, which always shows everything. The one
    // SignalR broadcast call site explicitly passes false, since that
    // reaches the whole vehicle group, not just moderators.
    private static BookingResponse ToBookingResponse(Booking b, bool includeOtp = true) => new(
        b.Id,
        b.VehicleId,
        b.Vehicle!.RegistrationNumber,
        b.Vehicle!.Type,
        b.PassengerId,
        b.Passenger!.Name,
        b.Passenger!.Phone,
        b.Vehicle!.Driver?.Phone,
        b.Status,
        b.FromLocation,
        b.ToLocation,
        b.FromLatitude,
        b.FromLongitude,
        b.Note,
        includeOtp ? b.OtpCode : null,
        b.OtpVerifiedAt is not null,
        b.CreatedAt,
        b.RespondedAt
    );

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

            // Same as the driver-initiated StopTracking path: an admin force-
            // stopping the vehicle is just as real a ride-end as the driver
            // pressing Stop themselves. Without this, a booking the driver had
            // already accepted would get stuck on "Accepted" forever with no
            // one able to act on it again.
            var acceptedBookingIds = await _db.Bookings
                .Where(b => b.VehicleId == vehicleId && b.Status == BookingStatus.Accepted)
                .Select(b => b.Id)
                .ToListAsync();

            if (acceptedBookingIds.Count > 0)
            {
                await _db.Database.ExecuteSqlInterpolatedAsync(
                    $"UPDATE \"Bookings\" SET \"Status\" = 'Completed', \"RespondedAt\" = {DateTime.UtcNow} WHERE \"VehicleId\" = {vehicleId} AND \"Status\" = 'Accepted'"
                );
            }

            await _db.SaveChangesAsync();

            await _hub.Clients.Group("passengers").SendAsync("VehicleStopped", vehicleId);
            await _hub.Clients.Group(TrackingHub.VehicleGroup(vehicleId)).SendAsync("VehicleStopped", vehicleId);

            if (acceptedBookingIds.Count > 0)
            {
                var completedBookings = await _db.Bookings
                    .Include(b => b.Vehicle).ThenInclude(v => v!.Driver)
                    .Include(b => b.Passenger)
                    .Where(b => acceptedBookingIds.Contains(b.Id))
                    .ToListAsync();

                foreach (var booking in completedBookings)
                {
                    // Never the full admin-shaped response here - this reaches
                    // everyone in the vehicle group, not just moderators.
                    await _hub.Clients.Group(TrackingHub.VehicleGroup(vehicleId))
                        .SendAsync("BookingCompleted", ToBookingResponse(booking, includeOtp: false));
                }
            }
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
