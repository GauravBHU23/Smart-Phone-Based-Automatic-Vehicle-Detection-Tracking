using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using VehicleTracking.Api.DTOs;
using VehicleTracking.Api.Services;

namespace VehicleTracking.Api.Controllers;

[ApiController]
[Route("api/directions")]
[Authorize]
public class DirectionsController : ControllerBase
{
    private readonly DirectionsService _directions;

    public DirectionsController(DirectionsService directions)
    {
        _directions = directions;
    }

    [HttpGet]
    public async Task<ActionResult<DirectionsResponse>> GetRoute(
        [FromQuery] double originLat,
        [FromQuery] double originLng,
        [FromQuery] double destLat,
        [FromQuery] double destLng)
    {
        var route = await _directions.GetRouteAsync(originLat, originLng, destLat, destLng);
        if (route is null) return NotFound("No route available.");
        return Ok(route);
    }
}
