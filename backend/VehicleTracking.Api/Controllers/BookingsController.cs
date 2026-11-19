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
[Route("api/bookings")]
[Authorize]
public class BookingsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<TrackingHub> _hub;
    private readonly PushNotificationService _push;

    public BookingsController(AppDbContext db, IHubContext<TrackingHub> hub, PushNotificationService push)
    {
        _db = db;
        _hub = hub;
        _push = push;
    }

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    private static BookingResponse ToResponse(Booking b, bool includePassengerPhone, bool includeDriverPhone) => new(
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
        b.Note,
        b.CreatedAt,
        b.RespondedAt
    );

    [HttpGet("mine")]
    [Authorize(Roles = "Passenger")]
    public async Task<ActionResult<List<BookingResponse>>> GetMyBookings()
    {
        var bookings = await _db.Bookings
            .Include(b => b.Vehicle).ThenInclude(v => v!.Driver)
            .Include(b => b.Passenger)
            .Where(b => b.PassengerId == CurrentUserId)
            .OrderByDescending(b => b.CreatedAt)
            .ToListAsync();

        // Passenger-facing: never show their own phone back to them, but do
        // surface the driver's once the booking is mutually accepted.
        return Ok(bookings.Select(b => ToResponse(b, includePassengerPhone: false, includeDriverPhone: true)).ToList());
    }

    [HttpPost("{bookingId:guid}/cancel")]
    [Authorize(Roles = "Passenger")]
    public async Task<IActionResult> CancelBooking(Guid bookingId)
    {
        var booking = await _db.Bookings
            .Include(b => b.Vehicle).ThenInclude(v => v!.Driver)
            .Include(b => b.Passenger)
            .SingleOrDefaultAsync(b => b.Id == bookingId && b.PassengerId == CurrentUserId);
        if (booking is null) return NotFound();

        // Idempotent no-op if already cancelled; an Accepted/Rejected booking
        // is a closed record the passenger can no longer unilaterally flip —
        // the driver already acted on it.
        if (booking.Status == BookingStatus.Cancelled) return NoContent();
        if (booking.Status != BookingStatus.Pending)
            return Conflict(ToResponse(booking, includePassengerPhone: false, includeDriverPhone: true));

        booking.Status = BookingStatus.Cancelled;
        booking.RespondedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await _hub.Clients.Group(TrackingHub.VehicleGroup(booking.VehicleId))
            .SendAsync("BookingCancelled", ToResponse(booking, includePassengerPhone: true, includeDriverPhone: false));

        return NoContent();
    }

    [HttpGet("driver")]
    [Authorize(Roles = "Driver")]
    public async Task<ActionResult<List<BookingResponse>>> GetDriverBookings()
    {
        var bookings = await _db.Bookings
            .Include(b => b.Vehicle).ThenInclude(v => v!.Driver)
            .Include(b => b.Passenger)
            .Where(b => b.Vehicle!.DriverId == CurrentUserId)
            .OrderByDescending(b => b.CreatedAt)
            .ToListAsync();

        // Driver-facing: show the passenger's phone so they can actually
        // coordinate the ride (no in-app chat exists).
        return Ok(bookings.Select(b => ToResponse(b, includePassengerPhone: true, includeDriverPhone: false)).ToList());
    }

    [HttpPost("{bookingId:guid}/accept")]
    [Authorize(Roles = "Driver")]
    public async Task<ActionResult<BookingResponse>> AcceptBooking(Guid bookingId)
    {
        var booking = await _db.Bookings
            .Include(b => b.Vehicle).ThenInclude(v => v!.Driver)
            .Include(b => b.Passenger)
            .SingleOrDefaultAsync(b => b.Id == bookingId && b.Vehicle!.DriverId == CurrentUserId);
        if (booking is null) return NotFound();

        if (booking.Status != BookingStatus.Pending)
            return Conflict(ToResponse(booking, includePassengerPhone: true, includeDriverPhone: false));

        // Atomic conditional UPDATE — same race-safety pattern as
        // CheckDestinationArrival's DestinationReachedAt flip. Two concurrent
        // accept attempts (double-tap, driver on two devices) must not both
        // "win"; only the request that actually flips Pending -> Accepted
        // proceeds to notify.
        var rowsUpdated = await _db.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE \"Bookings\" SET \"Status\" = 'Accepted', \"RespondedAt\" = {DateTime.UtcNow} WHERE \"Id\" = {booking.Id} AND \"Status\" = 'Pending'"
        );

        if (rowsUpdated == 0)
        {
            await _db.Entry(booking).ReloadAsync();
            return Conflict(ToResponse(booking, includePassengerPhone: true, includeDriverPhone: false));
        }

        booking.Status = BookingStatus.Accepted;
        booking.RespondedAt = DateTime.UtcNow;

        await _hub.Clients.Group(TrackingHub.VehicleGroup(booking.VehicleId))
            .SendAsync("BookingAccepted", ToResponse(booking, includePassengerPhone: true, includeDriverPhone: true));

        if (booking.Passenger?.PushToken is { Length: > 0 } passengerToken)
        {
            await _push.SendAsync(new[] { passengerToken }, "Ride request accepted",
                $"{booking.Vehicle!.RegistrationNumber} accepted your ride request.", new { bookingId = booking.Id });
        }

        return Ok(ToResponse(booking, includePassengerPhone: true, includeDriverPhone: false));
    }

    [HttpPost("{bookingId:guid}/reject")]
    [Authorize(Roles = "Driver")]
    public async Task<ActionResult<BookingResponse>> RejectBooking(Guid bookingId)
    {
        var booking = await _db.Bookings
            .Include(b => b.Vehicle).ThenInclude(v => v!.Driver)
            .Include(b => b.Passenger)
            .SingleOrDefaultAsync(b => b.Id == bookingId && b.Vehicle!.DriverId == CurrentUserId);
        if (booking is null) return NotFound();

        if (booking.Status != BookingStatus.Pending)
            return Conflict(ToResponse(booking, includePassengerPhone: true, includeDriverPhone: false));

        var rowsUpdated = await _db.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE \"Bookings\" SET \"Status\" = 'Rejected', \"RespondedAt\" = {DateTime.UtcNow} WHERE \"Id\" = {booking.Id} AND \"Status\" = 'Pending'"
        );

        if (rowsUpdated == 0)
        {
            await _db.Entry(booking).ReloadAsync();
            return Conflict(ToResponse(booking, includePassengerPhone: true, includeDriverPhone: false));
        }

        booking.Status = BookingStatus.Rejected;
        booking.RespondedAt = DateTime.UtcNow;

        await _hub.Clients.Group(TrackingHub.VehicleGroup(booking.VehicleId))
            .SendAsync("BookingRejected", ToResponse(booking, includePassengerPhone: true, includeDriverPhone: false));

        if (booking.Passenger?.PushToken is { Length: > 0 } passengerToken)
        {
            await _push.SendAsync(new[] { passengerToken }, "Ride request declined",
                $"{booking.Vehicle!.RegistrationNumber} couldn't take your ride request.", new { bookingId = booking.Id });
        }

        return Ok(ToResponse(booking, includePassengerPhone: true, includeDriverPhone: false));
    }
}
