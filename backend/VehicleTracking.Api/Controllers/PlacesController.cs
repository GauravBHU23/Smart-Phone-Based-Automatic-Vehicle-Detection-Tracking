using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VehicleTracking.Api.Data;
using VehicleTracking.Api.DTOs;

namespace VehicleTracking.Api.Controllers;

[ApiController]
[Route("api/places")]
public class PlacesController : ControllerBase
{
    private readonly AppDbContext _db;

    public PlacesController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet("search")]
    [AllowAnonymous]
    public async Task<ActionResult<List<PlaceDto>>> Search([FromQuery] string q)
    {
        if (string.IsNullOrWhiteSpace(q)) return Ok(new List<PlaceDto>());

        var term = q.Trim();

        var places = await _db.Places
            .Where(p => EF.Functions.ILike(p.Name, $"%{term}%"))
            .OrderBy(p => p.Name)
            .Take(15)
            .Select(p => new PlaceDto(p.Id, p.Code, p.Name, p.Latitude, p.Longitude))
            .ToListAsync();

        return Ok(places);
    }
}
