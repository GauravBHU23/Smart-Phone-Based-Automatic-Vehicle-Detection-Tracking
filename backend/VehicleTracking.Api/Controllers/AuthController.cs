using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VehicleTracking.Api.Data;
using VehicleTracking.Api.DTOs;
using VehicleTracking.Api.Models;
using VehicleTracking.Api.Services;

namespace VehicleTracking.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly TokenService _tokenService;
    private readonly CloudinaryService _cloudinary;

    public AuthController(AppDbContext db, TokenService tokenService, CloudinaryService cloudinary)
    {
        _db = db;
        _tokenService = tokenService;
        _cloudinary = cloudinary;
    }

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);

    private static AuthResponse ToAuthResponse(User user, string token) =>
        new(token, user.Id, user.Name, user.Phone, user.Role, user.ProfilePhotoUrl);

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request)
    {
        // Admin accounts are never created through public self-registration —
        // only Passenger/Driver. Admins are provisioned separately (see
        // AdminController's bootstrap endpoint), so this can't be bypassed by
        // simply sending role: "Admin" in the request body.
        if (request.Role == UserRole.Admin)
            return BadRequest("Admin accounts cannot be created through registration.");

        if (await _db.Users.AnyAsync(u => u.Phone == request.Phone))
            return Conflict("Phone number already registered.");

        var user = new User
        {
            Name = request.Name,
            Phone = request.Phone,
            Role = request.Role,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password)
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        var token = _tokenService.CreateToken(user);
        return Ok(ToAuthResponse(user, token));
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
    {
        var user = await _db.Users.SingleOrDefaultAsync(u => u.Phone == request.Phone);
        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Unauthorized("Invalid phone or password.");

        if (user.IsSuspended)
            return Unauthorized("This account has been suspended. Contact support for assistance.");

        var token = _tokenService.CreateToken(user);
        return Ok(ToAuthResponse(user, token));
    }

    [HttpPut("profile")]
    [Authorize]
    public async Task<ActionResult<AuthResponse>> UpdateProfile(UpdateProfileRequest request)
    {
        var user = await _db.Users.SingleAsync(u => u.Id == CurrentUserId);

        if (!string.IsNullOrWhiteSpace(request.Name))
            user.Name = request.Name.Trim();

        if (!string.IsNullOrWhiteSpace(request.Phone) && request.Phone != user.Phone)
        {
            if (await _db.Users.AnyAsync(u => u.Phone == request.Phone && u.Id != user.Id))
                return Conflict("Phone number already registered to another account.");
            user.Phone = request.Phone.Trim();
        }

        if (!string.IsNullOrWhiteSpace(request.NewPassword))
        {
            if (string.IsNullOrWhiteSpace(request.CurrentPassword) ||
                !BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
                return BadRequest("Current password is incorrect.");
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        }

        await _db.SaveChangesAsync();

        // A fresh token is required: Name is baked into the JWT as a claim
        // (TokenService.CreateToken), so an unchanged token would keep
        // showing the old name until it expires. Returning a full
        // AuthResponse lets both frontends just call their existing
        // signIn() again to refresh everything at once.
        var token = _tokenService.CreateToken(user);
        return Ok(ToAuthResponse(user, token));
    }

    [HttpPost("profile/photo")]
    [Authorize]
    [RequestSizeLimit(10_000_000)]
    public async Task<ActionResult<AuthResponse>> UploadProfilePhoto(IFormFile photo)
    {
        if (photo.Length == 0) return BadRequest("No photo provided.");

        var user = await _db.Users.SingleAsync(u => u.Id == CurrentUserId);

        string? url;
        await using (var stream = photo.OpenReadStream())
        {
            url = await _cloudinary.UploadAsync(stream, photo.FileName, "profile-photos");
        }
        if (url is null) return BadRequest("Could not upload photo. Please try again.");

        user.ProfilePhotoUrl = url;
        await _db.SaveChangesAsync();

        var token = _tokenService.CreateToken(user);
        return Ok(ToAuthResponse(user, token));
    }
}
