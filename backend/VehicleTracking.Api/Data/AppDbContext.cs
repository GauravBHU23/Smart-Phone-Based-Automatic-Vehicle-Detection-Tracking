using Microsoft.EntityFrameworkCore;
using VehicleTracking.Api.Models;

namespace VehicleTracking.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Vehicle> Vehicles => Set<Vehicle>();
    public DbSet<LocationPing> LocationPings => Set<LocationPing>();
    public DbSet<Trip> Trips => Set<Trip>();
    public DbSet<RouteStop> RouteStops => Set<RouteStop>();
    public DbSet<WatchedVehicle> WatchedVehicles => Set<WatchedVehicle>();
    public DbSet<Place> Places => Set<Place>();
    public DbSet<Booking> Bookings => Set<Booking>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(e =>
        {
            e.HasIndex(u => u.Phone).IsUnique();
            e.Property(u => u.Role).HasConversion<string>();
            e.Property(u => u.VerificationStatus).HasConversion<string>();
        });

        modelBuilder.Entity<Vehicle>(e =>
        {
            e.HasIndex(v => v.RegistrationNumber).IsUnique();
            e.Property(v => v.Type).HasConversion<string>();
            e.HasOne(v => v.Driver)
                .WithMany(u => u.Vehicles)
                .HasForeignKey(v => v.DriverId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(v => v.FromPlace)
                .WithMany()
                .HasForeignKey(v => v.FromPlaceId)
                .OnDelete(DeleteBehavior.SetNull);
            e.HasOne(v => v.ToPlace)
                .WithMany()
                .HasForeignKey(v => v.ToPlaceId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Place>(e =>
        {
            e.HasIndex(p => p.Code).IsUnique();
            // Case-insensitive uniqueness is enforced via a Postgres expression index on
            // lower("Name"), added by raw SQL in the migration (EF's fluent HasIndex can't
            // express a functional index) — see AddPlaceDirectory migration. FindOrCreatePlace
            // also normalizes to lowercase before the initial lookup, but this DB-level
            // constraint is what actually prevents two concurrent requests from both
            // inserting "Civil Lines" / "civil lines" as separate rows.
        });

        modelBuilder.Entity<LocationPing>(e =>
        {
            e.HasIndex(p => new { p.VehicleId, p.RecordedAt });
            e.HasOne(p => p.Vehicle)
                .WithMany(v => v.LocationPings)
                .HasForeignKey(p => p.VehicleId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Trip>(e =>
        {
            e.HasOne(t => t.Vehicle)
                .WithMany(v => v.Trips)
                .HasForeignKey(t => t.VehicleId)
                .OnDelete(DeleteBehavior.Cascade);

            // Hard database guarantee that a vehicle can never have more than one
            // open trip, even under concurrent Start requests (double-tap, retries).
            e.HasIndex(t => t.VehicleId)
                .IsUnique()
                .HasFilter("\"EndedAt\" IS NULL")
                .HasDatabaseName("IX_Trips_VehicleId_OpenTrip");
        });

        modelBuilder.Entity<RouteStop>(e =>
        {
            e.HasIndex(s => new { s.VehicleId, s.Order });
            e.HasOne(s => s.Vehicle)
                .WithMany(v => v.Stops)
                .HasForeignKey(s => s.VehicleId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(s => s.Place)
                .WithMany()
                .HasForeignKey(s => s.PlaceId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<WatchedVehicle>(e =>
        {
            e.HasIndex(w => new { w.UserId, w.VehicleId }).IsUnique();
            e.HasOne(w => w.User)
                .WithMany(u => u.WatchedVehicles)
                .HasForeignKey(w => w.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(w => w.Vehicle)
                .WithMany()
                .HasForeignKey(w => w.VehicleId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Booking>(e =>
        {
            e.Property(b => b.Status).HasConversion<string>();

            e.HasOne(b => b.Vehicle)
                .WithMany()
                .HasForeignKey(b => b.VehicleId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(b => b.Passenger)
                .WithMany()
                .HasForeignKey(b => b.PassengerId)
                .OnDelete(DeleteBehavior.Cascade);

            // A passenger can't have two pending requests open on the same
            // vehicle at once (blocks double-tap/retry noise), but different
            // passengers may each have their own pending request on the same
            // vehicle — there's no seat-capacity model here. Enforced at the
            // DB level, same partial-unique-index pattern as the Trip's
            // "one open trip per vehicle" guard.
            e.HasIndex(b => new { b.VehicleId, b.PassengerId })
                .IsUnique()
                .HasFilter("\"Status\" = 'Pending'")
                .HasDatabaseName("IX_Bookings_VehicleId_PassengerId_Pending");

            // A passenger can only have one active ride at a time across
            // ALL vehicles - matches Rapido/Ola. Enforced at the DB level
            // so a race between two near-simultaneous booking attempts
            // can't both succeed.
            e.HasIndex(b => b.PassengerId)
                .IsUnique()
                .HasFilter("\"Status\" IN ('Pending', 'Accepted')")
                .HasDatabaseName("IX_Bookings_PassengerId_Active");

            e.HasIndex(b => b.VehicleId);
            e.HasIndex(b => b.PassengerId);
        });
    }
}
