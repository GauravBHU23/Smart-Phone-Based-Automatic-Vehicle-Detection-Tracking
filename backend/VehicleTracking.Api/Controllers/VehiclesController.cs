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

        // Resolve From/To/Stops against the shared Place directory so route search
        // can match by exact place ID instead of fuzzy text — the passenger and
        // driver both pick from the same autocomplete, so this is usually already
        // an existing place; FindOrCreatePlace only inserts a new row the first
        // time any driver registers a never-seen-before place name.
        if (!string.IsNullOrWhiteSpace(request.FromLocation))
        {
            vehicle.FromPlaceId = request.FromPlaceId
                ?? await FindOrCreatePlace(request.FromLocation, null, null);
        }
        if (!string.IsNullOrWhiteSpace(request.ToLocation))
        {
            vehicle.ToPlaceId = request.ToPlaceId
                ?? await FindOrCreatePlace(request.ToLocation, request.DestinationLatitude, request.DestinationLongitude);
        }

        if (request.Stops is { Count: > 0 })
        {
            for (var i = 0; i < request.Stops.Count; i++)
            {
                var s = request.Stops[i];
                var placeId = s.PlaceId ?? await FindOrCreatePlace(s.Name, s.Latitude, s.Longitude);
                vehicle.Stops.Add(new RouteStop { Name = s.Name, Order = i, Latitude = s.Latitude, Longitude = s.Longitude, PlaceId = placeId });
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

    [HttpPut("{vehicleId:guid}")]
    [Authorize(Roles = "Driver")]
    public async Task<ActionResult<VehicleResponse>> UpdateVehicle(Guid vehicleId, UpdateVehicleRequest request)
    {
        var vehicle = await _db.Vehicles.Include(v => v.Stops).SingleOrDefaultAsync(v => v.Id == vehicleId && v.DriverId == CurrentUserId);
        if (vehicle is null) return NotFound();

        // Editing mid-trip would silently change what passengers are already
        // looking at on a live map — the driver must stop first, same
        // precondition as every other state-changing action in this
        // controller that's incompatible with an active trip.
        if (vehicle.IsActive) return BadRequest("Stop tracking before editing this vehicle.");

        var normalized = request.RegistrationNumber.Trim().ToUpperInvariant();
        if (normalized != vehicle.RegistrationNumber.ToUpperInvariant())
        {
            var exists = await _db.Vehicles.AnyAsync(v => v.Id != vehicleId && v.RegistrationNumber.ToUpper() == normalized);
            if (exists) return Conflict("A vehicle with this registration number is already registered.");
        }

        vehicle.RegistrationNumber = request.RegistrationNumber;
        vehicle.Type = request.Type;
        vehicle.FromLocation = request.FromLocation;
        vehicle.ToLocation = request.ToLocation;
        vehicle.DestinationLatitude = request.DestinationLatitude;
        vehicle.DestinationLongitude = request.DestinationLongitude;

        vehicle.FromPlaceId = !string.IsNullOrWhiteSpace(request.FromLocation)
            ? request.FromPlaceId ?? await FindOrCreatePlace(request.FromLocation, null, null)
            : null;
        vehicle.ToPlaceId = !string.IsNullOrWhiteSpace(request.ToLocation)
            ? request.ToPlaceId ?? await FindOrCreatePlace(request.ToLocation, request.DestinationLatitude, request.DestinationLongitude)
            : null;

        // Stops have no identity passengers depend on across an edit — replace
        // the whole set rather than diffing, which is both simpler and safer.
        _db.RouteStops.RemoveRange(vehicle.Stops);
        vehicle.Stops.Clear();
        if (request.Stops is { Count: > 0 })
        {
            for (var i = 0; i < request.Stops.Count; i++)
            {
                var s = request.Stops[i];
                var placeId = s.PlaceId ?? await FindOrCreatePlace(s.Name, s.Latitude, s.Longitude);
                vehicle.Stops.Add(new RouteStop { Name = s.Name, Order = i, Latitude = s.Latitude, Longitude = s.Longitude, PlaceId = placeId });
            }
        }

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict("A vehicle with this registration number is already registered.");
        }

        return Ok(ToVehicleResponse(vehicle));
    }

    [HttpDelete("{vehicleId:guid}")]
    [Authorize(Roles = "Driver")]
    public async Task<IActionResult> DeleteVehicle(Guid vehicleId)
    {
        var vehicle = await _db.Vehicles.SingleOrDefaultAsync(v => v.Id == vehicleId && v.DriverId == CurrentUserId);
        if (vehicle is null) return NotFound();
        if (vehicle.IsActive) return BadRequest("Stop tracking before deleting this vehicle.");

        // Cascade delete already handles Trips/LocationPings/RouteStops/
        // Bookings/WatchedVehicles — all FKs to Vehicle are DeleteBehavior.Cascade.
        _db.Vehicles.Remove(vehicle);
        await _db.SaveChangesAsync();

        return NoContent();
    }

    /// <summary>
    /// Resolves a place name to a Place row, creating one if this exact name
    /// (case-insensitive) has never been seen before. Two drivers registering
    /// the same new place name concurrently both reach the insert path; the
    /// unique index on Name (case-insensitive, see AppDbContext) means only one
    /// insert wins — the loser retries the lookup and finds the winner's row,
    /// the same DbUpdateException-then-reread pattern used for vehicle
    /// registration numbers above.
    /// </summary>
    private async Task<Guid> FindOrCreatePlace(string name, double? latitude, double? longitude)
    {
        var trimmed = NormalizePlaceName(name);

        var existing = await _db.Places.FirstOrDefaultAsync(p => EF.Functions.ILike(p.Name, trimmed));
        if (existing is not null)
        {
            // First successful geocode for this place wins and sticks; don't
            // overwrite known coordinates with a null from a later registration.
            if (existing.Latitude is null && existing.Longitude is null && latitude is not null && longitude is not null)
            {
                existing.Latitude = latitude;
                existing.Longitude = longitude;
                await _db.SaveChangesAsync();
            }
            return existing.Id;
        }

        var place = new Place
        {
            Code = await GenerateUniquePlaceCode(trimmed),
            Name = trimmed,
            Latitude = latitude,
            Longitude = longitude
        };

        _db.Places.Add(place);

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            _db.Entry(place).State = EntityState.Detached;
            var winner = await _db.Places.FirstOrDefaultAsync(p => EF.Functions.ILike(p.Name, trimmed));
            if (winner is not null) return winner.Id;
            throw; // Unexpected: conflict wasn't on the name after all.
        }

        return place.Id;
    }

    private async Task<string> GenerateUniquePlaceCode(string name)
    {
        var alphanumeric = new string(name.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
        var baseCode = alphanumeric.Length >= 4 ? alphanumeric[..4] : alphanumeric.PadRight(4, 'X');
        if (baseCode.Length == 0) baseCode = "PLAC";

        var code = baseCode;
        var suffix = 1;
        while (await _db.Places.AnyAsync(p => p.Code == code))
        {
            suffix++;
            code = $"{baseCode}{suffix}";
        }

        return code;
    }

    // Collapses internal whitespace too, not just leading/trailing — otherwise
    // "Civil Lines" and "civil  lines" (double space) would be treated as two
    // different places, defeating the whole point of the directory.
    private static string NormalizePlaceName(string name) =>
        string.Join(' ', name.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

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

        // Same staleness guard as GetActiveVehicles: IsActive alone doesn't
        // mean a vehicle is really live if its driver's app stopped sending
        // pings without ever calling /stop (crash, killed app, lost network).
        var isReallyActive = vehicle.IsActive && lastPing is not null && lastPing.RecordedAt >= DateTime.UtcNow - ActiveStalenessThreshold;

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
            isReallyActive,
            lastPing?.Latitude,
            lastPing?.Longitude,
            lastPing?.SpeedKmh,
            lastPing?.RecordedAt,
            isReallyActive ? trip?.StartedAt : null,
            isReallyActive && trip is not null ? Math.Round(distanceCoveredKm, 2) : null
        );
    }

    // includeOtp must only be true on a response that goes directly and
    // exclusively to the passenger's own request - never on a SignalR
    // broadcast, which reaches everyone in the vehicle-{id} group including
    // the driver.
    private static BookingResponse ToBookingResponse(Booking b, bool includePassengerPhone, bool includeDriverPhone, bool includeOtp = false) => new(
        b.Id,
        b.VehicleId,
        b.Vehicle!.RegistrationNumber,
        b.Vehicle!.Type,
        b.PassengerId,
        b.Passenger!.Name,
        includePassengerPhone ? b.Passenger!.Phone : null,
        includeDriverPhone && (b.Status == BookingStatus.Accepted || b.Status == BookingStatus.Completed) ? b.Vehicle!.Driver?.Phone : null,
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

    [HttpPost("{vehicleId:guid}/bookings")]
    [Authorize(Roles = "Passenger")]
    public async Task<ActionResult<BookingResponse>> CreateBooking(Guid vehicleId, CreateBookingRequest request)
    {
        var vehicle = await _db.Vehicles.Include(v => v.Driver).SingleOrDefaultAsync(v => v.Id == vehicleId);
        if (vehicle is null) return NotFound("Vehicle not found.");
        if (vehicle.IsSuspended) return BadRequest("This vehicle is currently suspended and cannot accept bookings.");

        // One active ride at a time, across every vehicle - matches
        // Rapido/Ola. The DB-level partial unique index below is the real
        // guard against a race; this is just a friendlier early check.
        var activeElsewhere = await _db.Bookings
            .Include(b => b.Vehicle).ThenInclude(v => v!.Driver)
            .Include(b => b.Passenger)
            .FirstOrDefaultAsync(b => b.PassengerId == CurrentUserId &&
                (b.Status == BookingStatus.Pending || b.Status == BookingStatus.Accepted));
        if (activeElsewhere is not null)
            return Conflict(ToBookingResponse(activeElsewhere, includePassengerPhone: false, includeDriverPhone: true, includeOtp: true));

        var booking = new Booking
        {
            VehicleId = vehicleId,
            PassengerId = CurrentUserId,
            FromLocation = request.FromLocation,
            ToLocation = request.ToLocation,
            FromLatitude = request.FromLatitude,
            FromLongitude = request.FromLongitude,
            Note = request.Note
        };

        _db.Bookings.Add(booking);

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Race: same passenger double-submitted, or already has an
            // active booking (same vehicle or elsewhere) from an earlier
            // screen. Re-read and return the existing booking instead of a
            // dead-end error.
            var existing = await _db.Bookings
                .Include(b => b.Vehicle).ThenInclude(v => v!.Driver)
                .Include(b => b.Passenger)
                .FirstOrDefaultAsync(b => b.PassengerId == CurrentUserId &&
                    (b.Status == BookingStatus.Pending || b.Status == BookingStatus.Accepted));
            if (existing is not null) return Conflict(ToBookingResponse(existing, includePassengerPhone: false, includeDriverPhone: true, includeOtp: true));
            throw;
        }

        await _db.Entry(booking).Reference(b => b.Vehicle).LoadAsync();
        await _db.Entry(booking).Reference(b => b.Passenger).LoadAsync();

        await _hub.Clients.Group(TrackingHub.VehicleGroup(vehicleId))
            .SendAsync("BookingRequested", ToBookingResponse(booking, includePassengerPhone: true, includeDriverPhone: false));

        if (vehicle.Driver?.PushToken is { Length: > 0 } driverToken)
        {
            await _push.SendAsync(new[] { driverToken }, "New ride request",
                $"A passenger has requested a ride on {vehicle.RegistrationNumber}.", new { bookingId = booking.Id, vehicleId });
        }

        return Ok(ToBookingResponse(booking, includePassengerPhone: false, includeDriverPhone: true, includeOtp: true));
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
        if (vehicle.IsSuspended) return Forbid();

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
        var vehicle = await _db.Vehicles.Include(v => v.Driver).SingleOrDefaultAsync(v => v.Id == vehicleId && v.DriverId == CurrentUserId);
        if (vehicle is null) return NotFound();

        vehicle.IsActive = false;

        var openTrip = await _db.Trips
            .Where(t => t.VehicleId == vehicleId && t.EndedAt == null)
            .OrderByDescending(t => t.StartedAt)
            .FirstOrDefaultAsync();
        if (openTrip is not null) openTrip.EndedAt = DateTime.UtcNow;

        // The driver stopping is the natural real-world end of a ride — any
        // booking this driver accepted for this vehicle is now actually over,
        // not still "Accepted" forever. A booking still Pending here just
        // never got answered in time and is left as-is (not auto-rejected —
        // the driver may start again and still take it).
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
        await NotifyWatchers(vehicleId, "Tracking stopped", $"{vehicle.RegistrationNumber} has stopped sharing its location.");

        if (acceptedBookingIds.Count > 0)
        {
            var completedBookings = await _db.Bookings
                .Include(b => b.Vehicle).ThenInclude(v => v!.Driver)
                .Include(b => b.Passenger)
                .Where(b => acceptedBookingIds.Contains(b.Id))
                .ToListAsync();

            foreach (var booking in completedBookings)
            {
                await _hub.Clients.Group(TrackingHub.VehicleGroup(vehicleId))
                    .SendAsync("BookingCompleted", ToBookingResponse(booking, includePassengerPhone: true, includeDriverPhone: true));
            }
        }

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

    // A vehicle whose driver's app was killed, crashed, or lost connectivity
    // without ever calling /stop can stay IsActive=true indefinitely with no
    // new pings arriving — showing it as "live" would freeze a stale marker
    // on every passenger's map forever. Treat anything with no ping in the
    // last 2 minutes (well beyond the 5s driver ping interval) as effectively
    // stopped for display purposes, even though the DB row hasn't been
    // explicitly stopped.
    private static readonly TimeSpan ActiveStalenessThreshold = TimeSpan.FromMinutes(2);

    [HttpGet("active")]
    [AllowAnonymous]
    public async Task<ActionResult<List<VehicleWithLocationResponse>>> GetActiveVehicles([FromQuery] VehicleType? type)
    {
        var staleCutoff = DateTime.UtcNow - ActiveStalenessThreshold;

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
            .Where(v => v.LastPing != null && v.LastPing.RecordedAt >= staleCutoff)
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

    [HttpGet("search-by-route")]
    [AllowAnonymous]
    public async Task<ActionResult<List<RouteSearchResultResponse>>> SearchByRoute(
        [FromQuery] Guid fromPlaceId,
        [FromQuery] Guid toPlaceId)
    {
        if (fromPlaceId == Guid.Empty || toPlaceId == Guid.Empty)
            return BadRequest("Both fromPlaceId and toPlaceId are required.");

        // Narrow to vehicles whose route touches either place at all (indexed FK
        // lookups) before doing the ordered-position check in memory — avoids a
        // full table scan on every search, unlike the old text-Contains version.
        var candidateVehicles = await _db.Vehicles
            .Include(v => v.Driver)
            .Include(v => v.Stops)
            .Where(v =>
                v.FromPlaceId == fromPlaceId || v.ToPlaceId == fromPlaceId ||
                v.FromPlaceId == toPlaceId || v.ToPlaceId == toPlaceId ||
                v.Stops.Any(s => s.PlaceId == fromPlaceId || s.PlaceId == toPlaceId))
            .ToListAsync();

        var matches = new List<Vehicle>();
        foreach (var vehicle in candidateVehicles)
        {
            // Build the vehicle's full ordered route: From (position 0), each
            // stop in sequence, then To (last position) — then find where the
            // searched from/to place IDs appear in that sequence. Matching both
            // by ID alone isn't enough: it would also match someone searching
            // the reverse direction of this vehicle's route, so we additionally
            // require the "from" match to come at an earlier position than the
            // "to" match.
            var routePlaceIds = new List<Guid?>();
            routePlaceIds.Add(vehicle.FromPlaceId);
            routePlaceIds.AddRange(vehicle.Stops.OrderBy(s => s.Order).Select(s => s.PlaceId));
            routePlaceIds.Add(vehicle.ToPlaceId);

            var fromIndex = routePlaceIds.FindIndex(id => id == fromPlaceId);
            var toIndex = routePlaceIds.FindIndex(id => id == toPlaceId);

            if (fromIndex >= 0 && toIndex >= 0 && fromIndex < toIndex)
            {
                matches.Add(vehicle);
            }
        }

        var vehicleIds = matches.Select(v => v.Id).ToList();
        var lastPings = await _db.LocationPings
            .Where(p => vehicleIds.Contains(p.VehicleId))
            .GroupBy(p => p.VehicleId)
            .Select(g => g.OrderByDescending(p => p.RecordedAt).First())
            .ToDictionaryAsync(p => p.VehicleId);

        var result = matches.Select(v =>
        {
            lastPings.TryGetValue(v.Id, out var lastPing);
            return new RouteSearchResultResponse(
                v.Id,
                v.RegistrationNumber,
                v.Type,
                v.Driver?.Name ?? "Unknown",
                v.FromLocation,
                v.ToLocation,
                v.Stops.OrderBy(s => s.Order).Select(s => new StopDto(s.Name, s.Latitude, s.Longitude, false)).ToList(),
                v.IsActive,
                lastPing?.Latitude,
                lastPing?.Longitude,
                lastPing?.SpeedKmh,
                lastPing?.RecordedAt
            );
        })
        // Live vehicles first, so a passenger sees what's actually running before registered-but-idle routes.
        .OrderByDescending(v => v.IsActive)
        .ToList();

        return Ok(result);
    }
}
