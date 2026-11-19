using VehicleTracking.Api.Models;

namespace VehicleTracking.Api.DTOs;

public record RegisterRequest(string Name, string Phone, string Password, UserRole Role);

public record LoginRequest(string Phone, string Password);

public record UpdateProfileRequest(string? Name, string? Phone, string? CurrentPassword, string? NewPassword);

public record AuthResponse(string Token, Guid UserId, string Name, string Phone, UserRole Role, string? ProfilePhotoUrl);
