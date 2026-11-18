using System.Security.Claims;
using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using VehicleTracking.Api.Data;
using VehicleTracking.Api.Hubs;
using VehicleTracking.Api.Models;
using VehicleTracking.Api.Services;

var builder = WebApplication.CreateBuilder(args);

const string CorsPolicy = "AllowAll";

builder.Services.AddControllers()
    .AddJsonOptions(options =>
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

builder.Services.AddSignalR();
builder.Services.AddSingleton<TokenService>();
builder.Services.AddHttpClient<PushNotificationService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicy, policy =>
        policy.AllowAnyHeader().AllowAnyMethod().SetIsOriginAllowed(_ => true).AllowCredentials());
});

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!))
        };

        // Allow SignalR clients to send the JWT via query string (WebSocket connections can't set headers easily).
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            },
            // A JWT stays valid until it expires, but a suspension must take effect
            // immediately — not whenever the token happens to expire. Checking the
            // live IsSuspended flag on every authenticated request (one indexed
            // lookup) closes that gap.
            OnTokenValidated = async context =>
            {
                var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                var userIdClaim = context.Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                    ?? context.Principal?.FindFirst("sub")?.Value;

                if (!Guid.TryParse(userIdClaim, out var userId))
                {
                    context.Fail("Invalid token.");
                    return;
                }

                var isSuspended = await db.Users
                    .Where(u => u.Id == userId)
                    .Select(u => u.IsSuspended)
                    .FirstOrDefaultAsync();

                if (isSuspended)
                {
                    context.Fail("This account has been suspended.");
                }
            }
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

// Kept available outside Development too: it's read-only API documentation,
// not an admin surface, and having it reachable on the deployed Render URL
// is the simplest way to health-check a fresh deploy.
app.UseSwagger();
app.UseSwaggerUI();

app.UseHttpsRedirection();

app.UseCors(CorsPolicy);

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<TrackingHub>("/hubs/tracking");

// Provision the first Admin account from config on startup, if one doesn't
// already exist for this phone number. This is the only way an Admin account
// is ever created — never through public registration — and running it again
// is a no-op, so restarts are safe.
await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    // No deployment step currently runs `dotnet ef database update` against
    // the target database — a fresh cloud Postgres (e.g. on Render) has no
    // schema at all until this runs, and the admin-seed check just below
    // would otherwise throw against a database with no Users table.
    // Idempotent: EF Core tracks applied migrations, so this is a no-op on
    // every restart once the schema is current.
    await db.Database.MigrateAsync();

    var adminPhone = app.Configuration["AdminSeed:Phone"];
    var adminPassword = app.Configuration["AdminSeed:Password"];

    if (!string.IsNullOrWhiteSpace(adminPhone) && !string.IsNullOrWhiteSpace(adminPassword))
    {
        var exists = await db.Users.AnyAsync(u => u.Phone == adminPhone);
        if (!exists)
        {
            db.Users.Add(new User
            {
                Name = "Admin",
                Phone = adminPhone,
                Role = UserRole.Admin,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword)
            });
            await db.SaveChangesAsync();
        }
    }
}

app.Run();
