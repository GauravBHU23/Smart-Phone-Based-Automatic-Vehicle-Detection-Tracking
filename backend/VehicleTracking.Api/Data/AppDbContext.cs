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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(e =>
        {
            e.HasIndex(u => u.Phone).IsUnique();
            e.Property(u => u.Role).HasConversion<string>();
        });

        modelBuilder.Entity<Vehicle>(e =>
        {
            e.HasIndex(v => v.RegistrationNumber).IsUnique();
            e.Property(v => v.Type).HasConversion<string>();
            e.HasOne(v => v.Driver)
                .WithMany(u => u.Vehicles)
                .HasForeignKey(v => v.DriverId)
                .OnDelete(DeleteBehavior.Cascade);
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
        });

        modelBuilder.Entity<RouteStop>(e =>
        {
            e.HasIndex(s => new { s.VehicleId, s.Order });
            e.HasOne(s => s.Vehicle)
                .WithMany(v => v.Stops)
                .HasForeignKey(s => s.VehicleId)
                .OnDelete(DeleteBehavior.Cascade);
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
    }
}
