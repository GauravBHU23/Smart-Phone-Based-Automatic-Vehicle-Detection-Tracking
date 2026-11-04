using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using VehicleTracking.Api.Data;
using VehicleTracking.Api.DTOs;
using VehicleTracking.Api.Hubs;
using VehicleTracking.Api.Models;
using VehicleTracking.Api.Services;

namespace VehicleTracking.Api.Controllers;

[ApiController]
[Route("api/vehicles")]
[Authorize]
public class VehiclesController : ControllerBase
{
    private const double DestinationArrivalRadiusMeters = 150;

    private readonly AppDbContext _db;
    private readonly IHubContext<TrackingHub> _hub;
    private readonly PushNotificationService _push;

    public VehiclesController(AppDbContext db, IHubContext<TrackingHub> hub, PushNotificationService push)
    {
        _db = db;
        _hub = hub;
        _push = push;
    }

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    private static VehicleResponse ToVehicleResponse(Vehicle v) => new(
        v.Id,
        v.RegistrationNumber,
        v.Type,
        v.FromLocation,
        v.ToLocation,
        v.DestinationLatitude,
        v.DestinationLongitude,
        v.Stops.OrderBy(s => s.Order).Select(s => new StopDto(s.Name, s.Latitude, s.Longitude, false)).ToList(),
        v.IsActive
    );

    [HttpPost]
    [Authorize(Roles = "Driver")]
    public async Task<ActionResult<VehicleResponse>> RegisterVehicle(RegisterVehicleRequest request)
    {
        var normalized = request.RegistrationNumber.Trim().ToUpperInvariant();
        var exists = await _db.Vehicles.AnyAsync(v => v.RegistrationNumber.ToUpper() == normalized);
        if (exists) return Conflict("A vehicle with this registration number is already registered.");

        var vehicle = new Vehicle
        {
            RegistrationNumber = request.RegistrationNumber,
            Type = request.Type,
            FromLocation = request.FromLocation,
            ToLocation = request.ToLocation,
            DestinationLatitude = request.DestinationLatitude,
            DestinationLongitude = request.DestinationLongitude,
            DriverId = CurrentUserId
        };

        if (request.Stops is { Count: > 0 })
        {
            for (var i = 0; i < request.Stops.Count; i++)
            {
                var s = request.Stops[i];
                vehicle.Stops.Add(new RouteStop { Name = s.Name, Order = i, Latitude = s.Latitude, Longitude = s.Longitude });
            }
        }

        _db.Vehicles.Add(vehicle);

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Race condition: another request registered the same number between our check and insert.
            return Conflict("A vehicle with this registration number is already registered.");
        }

        return Ok(ToVehicleResponse(vehicle));
    }

    [HttpGet("mine")]
    [Authorize(Roles = "Driver")]
    public async Task<ActionResult<List<VehicleResponse>>> GetMyVehicles()
    {
        var vehicles = await _db.Vehicles
            .Include(v => v.Stops)
            .Where(v => v.DriverId == CurrentUserId)
            .ToListAsync();

        return Ok(vehicles.Select(ToVehicleResponse).ToList());
    }

    [HttpGet("search")]
    [AllowAnonymous]
    public async Task<ActionResult<VehicleStatusResponse>> SearchByRegistrationNumber([FromQuery] string regNumber)
    {
        if (string.IsNullOrWhiteSpace(regNumber)) return BadRequest("regNumber is required.");

        var normalized = regNumber.Trim().ToUpperInvariant();

        var vehicle = await _db.Vehicles
            .Include(v => v.Driver)
            .Include(v => v.Stops)
            .SingleOrDefaultAsync(v => v.RegistrationNumber.ToUpper() == normalized);

        if (vehicle is null) return NotFound("No vehicle found with that registration number.");

        return Ok(await BuildStatusResponse(vehicle));
    }

    [HttpGet("{vehicleId:guid}/status")]
    [AllowAnonymous]
    public async Task<ActionResult<VehicleStatusResponse>> GetStatus(Guid vehicleId)
    {
        var vehicle = await _db.Vehicles
            .Include(v => v.Driver)
            .Include(v => v.Stops)
            .SingleOrDefaultAsync(v => v.Id == vehicleId);

        if (vehicle is null) return NotFound();

        return Ok(await BuildStatusResponse(vehicle));
    }

    private const double StopReachedRadiusMeters = 300;

    private async Task<VehicleStatusResponse> BuildStatusResponse(Vehicle vehicle)
    {
        var lastPing = await _db.LocationPings
            .Where(p => p.VehicleId == vehicle.Id)
            .OrderByDescending(p => p.RecordedAt)
            .FirstOrDefaultAsync();

        // Use the most recent trip (current if active, otherwise the last completed
        // one) so a finished trip still shows which stops were actually passed,
        // instead of resetting to "not reached" the moment the driver stops.
        var trip = await _db.Trips
            .Where(t => t.VehicleId == vehicle.Id)
            .OrderByDescending(t => t.StartedAt)
            .FirstOrDefaultAsync();

        double distanceCoveredKm = 0;
        var orderedStops = vehicle.Stops.OrderBy(s => s.Order).ToList();
        var reachedStopIds = new HashSet<Guid>();

        if (trip is not null)
        {
            var pings = await _db.LocationPings
                .Where(p => p.VehicleId == vehicle.Id && p.RecordedAt >= trip.StartedAt)
                .OrderBy(p => p.RecordedAt)
                .ToListAsync();

            for (var i = 1; i < pings.Count; i++)
            {
                distanceCoveredKm += HaversineKm(pings[i - 1].Latitude, pings[i - 1].Longitude, pings[i].Latitude, pings[i].Longitude);
            }

            // A stop is "reached" once any GPS ping on this trip came within
            // StopReachedRadiusMeters of it — real position data, not a guess.
            foreach (var stop in orderedStops)
            {
                if (stop.Latitude is null || stop.Longitude is null) continue;
                var wasNear = pings.Any(p =>
                    HaversineKm(p.Latitude, p.Longitude, stop.Latitude.Value, stop.Longitude.Value) * 1000 <= StopReachedRadiusMeters);
                if (wasNear) reachedStopIds.Add(stop.Id);
            }
        }

        var stopDtos = orderedStops
            .Select(s => new StopDto(s.Name, s.Latitude, s.Longitude, reachedStopIds.Contains(s.Id)))
            .ToList();

        return new VehicleStatusResponse(
            vehicle.Id,
            vehicle.RegistrationNumber,
            vehicle.Type,
            vehicle.Driver?.Name ?? "Unknown",
            vehicle.FromLocation,
            vehicle.ToLocation,
            vehicle.DestinationLatitude,
            vehicle.DestinationLongitude,
            stopDtos,
            vehicle.IsActive,
            lastPing?.Latitude,
            lastPing?.Longitude,
            lastPing?.SpeedKmh,
            lastPing?.RecordedAt,
            vehicle.IsActive ? trip?.StartedAt : null,
            vehicle.IsActive && trip is not null ? Math.Round(distanceCoveredKm, 2) : null
        );
    }

    [HttpPost("{vehicleId:guid}/watch")]
    public async Task<IActionResult> WatchVehicle(Guid vehicleId)
    {
        var vehicleExists = await _db.Vehicles.AnyAsync(v => v.Id == vehicleId);
        if (!vehicleExists) return NotFound();

        var already = await _db.WatchedVehicles.AnyAsync(w => w.UserId == CurrentUserId && w.VehicleId == vehicleId);
        if (!already)
        {
            _db.WatchedVehicles.Add(new WatchedVehicle { UserId = CurrentUserId, VehicleId = vehicleId });
            await _db.SaveChangesAsync();
        }

        return NoContent();
    }

    [HttpPost("{vehicleId:guid}/unwatch")]
    public async Task<IActionResult> UnwatchVehicle(Guid vehicleId)
    {
        var watch = await _db.WatchedVehicles.SingleOrDefaultAsync(w => w.UserId == CurrentUserId && w.VehicleId == vehicleId);
        if (watch is not null)
        {
            _db.WatchedVehicles.Remove(watch);
            await _db.SaveChangesAsync();
        }

        return NoContent();
    }

    [HttpPut("push-token")]
    public async Task<IActionResult> RegisterPushToken(RegisterPushTokenRequest request)
    {
        var user = await _db.Users.SingleAsync(u => u.Id == CurrentUserId);
        user.PushToken = request.PushToken;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{vehicleId:guid}/start")]
    [Authorize(Roles = "Driver")]
    public async Task<IActionResult> StartTracking(Guid vehicleId)
    {
        var vehicle = await _db.Vehicles.SingleOrDefaultAsync(v => v.Id == vehicleId && v.DriverId == CurrentUserId);
        if (vehicle is null) return NotFound();

        // Idempotent: a double-tap or client retry on a flaky connection must not
        // create a second open trip for the same vehicle. Reuse the existing one.
        var openTrip = await _db.Trips
            .Where(t => t.VehicleId == vehicleId && t.EndedAt == null)
            .OrderByDescending(t => t.StartedAt)
            .FirstOrDefaultAsync();

        var alreadyActive = vehicle.IsActive && openTrip is not null;

        vehicle.IsActive = true;
        if (openTrip is null)
        {
            _db.Trips.Add(new Trip { VehicleId = vehicleId });
        }

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Lost a race with a concurrent Start request for the same vehicle;
            // the other request's trip is now the open one. Nothing more to do.
            alreadyActive = true;
        }

        if (!alreadyActive)
        {
            await _hub.Clients.Group("passengers").SendAsync("VehicleStarted", vehicleId);
            await _hub.Clients.Group(TrackingHub.VehicleGroup(vehicleId)).SendAsync("VehicleStarted", vehicleId);
            await NotifyWatchers(vehicleId, "Tracking started", $"{vehicle.RegistrationNumber} is now sharing its live location.");
        }

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
        await NotifyWatchers(vehicleId, "Tracking stopped", $"{vehicle.RegistrationNumber} has stopped sharing its location.");

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

        await CheckDestinationArrival(vehicle, ping);

        return NoContent();
    }

    private async Task CheckDestinationArrival(Vehicle vehicle, LocationPing ping)
    {
        if (vehicle.DestinationLatitude is null || vehicle.DestinationLongitude is null) return;

        var distanceMeters = HaversineKm(ping.Latitude, ping.Longitude, vehicle.DestinationLatitude.Value, vehicle.DestinationLongitude.Value) * 1000;
        if (distanceMeters > DestinationArrivalRadiusMeters) return;

        var openTrip = await _db.Trips
            .Where(t => t.VehicleId == vehicle.Id && t.EndedAt == null)
            .OrderByDescending(t => t.StartedAt)
            .FirstOrDefaultAsync();

        if (openTrip is null || openTrip.DestinationReachedAt is not null) return; // already notified for this trip

        // Two GPS pings arriving close together (client retry on a flaky network)
        // could both reach this point before either SaveChanges commits. The
        // conditional UPDATE below is atomic at the database level — only the
        // request that actually flips DestinationReachedAt from NULL goes on to
        // fire the notification, so "arrived" can never be sent twice for one trip.
        var rowsUpdated = await _db.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE \"Trips\" SET \"DestinationReachedAt\" = {DateTime.UtcNow} WHERE \"Id\" = {openTrip.Id} AND \"DestinationReachedAt\" IS NULL"
        );

        if (rowsUpdated == 0) return; // lost the race to another request for the same ping/trip

        await _hub.Clients.Group("passengers").SendAsync("VehicleReachedDestination", vehicle.Id);
        await _hub.Clients.Group(TrackingHub.VehicleGroup(vehicle.Id)).SendAsync("VehicleReachedDestination", vehicle.Id);
        await NotifyWatchers(
            vehicle.Id,
            "Destination reached",
            $"{vehicle.RegistrationNumber} has arrived at {vehicle.ToLocation ?? "its destination"}."
        );
    }

    private async Task NotifyWatchers(Guid vehicleId, string title, string body)
    {
        var tokens = await _db.WatchedVehicles
            .Where(w => w.VehicleId == vehicleId && w.User!.PushToken != null)
            .Select(w => w.User!.PushToken!)
            .ToListAsync();

        await _push.SendAsync(tokens, title, body, new { vehicleId });
    }

    private static double HaversineKm(double lat1, double lon1, double lat2, double lon2)
    {
        const double earthRadiusKm = 6371;
        var dLat = DegreesToRadians(lat2 - lat1);
        var dLon = DegreesToRadians(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(DegreesToRadians(lat1)) * Math.Cos(DegreesToRadians(lat2)) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return earthRadiusKm * c;
    }

    private static double DegreesToRadians(double degrees) => degrees * Math.PI / 180;

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
                v.FromLocation,
                v.ToLocation,
                LastPing = v.LocationPings.OrderByDescending(p => p.RecordedAt).FirstOrDefault()
            })
            .ToListAsync();

        var result = vehicles.Select(v => new VehicleWithLocationResponse(
            v.Id,
            v.RegistrationNumber,
            v.Type,
            v.FromLocation,
            v.ToLocation,
            v.LastPing?.Latitude,
            v.LastPing?.Longitude,
            v.LastPing?.SpeedKmh,
            v.LastPing?.RecordedAt
        )).ToList();

        return Ok(result);
    }
}
