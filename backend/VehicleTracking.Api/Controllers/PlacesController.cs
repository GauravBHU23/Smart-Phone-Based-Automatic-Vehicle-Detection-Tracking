using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VehicleTracking.Api.Data;
using VehicleTracking.Api.DTOs;
using VehicleTracking.Api.Models;
using VehicleTracking.Api.Services;

namespace VehicleTracking.Api.Controllers;

[ApiController]
[Route("api/places")]
public class PlacesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly NominatimGeocodingService _geocoder;

    public PlacesController(AppDbContext db, NominatimGeocodingService geocoder)
    {
        _db = db;
        _geocoder = geocoder;
    }

    [HttpGet("search")]
    [AllowAnonymous]
    public async Task<ActionResult<PlaceSearchResponse>> Search([FromQuery] string? q, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(q)) return Ok(new PlaceSearchResponse(new List<PlaceDto>(), new List<ExternalPlaceDto>()));

        var term = q.Trim();

        // Places already in our own directory (registered by a driver before,
        // or previously picked from a Nominatim result) always come first —
        // they're the most relevant since real vehicles already use them.
        var knownPlaces = await _db.Places
            .Where(p => EF.Functions.ILike(p.Name, $"%{term}%"))
            .OrderBy(p => p.Name)
            .Take(15)
            .Select(p => new PlaceDto(p.Id, p.Code, p.Name, p.Latitude, p.Longitude))
            .ToListAsync(cancellationToken);

        // Only call out to Nominatim when the query is long enough to be a
        // real place name (avoids hammering it on every single keystroke
        // from a 1-2 character query) and we don't already have a good match.
        var suggestedPlaces = term.Length >= 3
            ? await _geocoder.SearchAsync(term, cancellationToken)
            : new List<ExternalPlaceDto>();

        // Drop any Nominatim suggestion that's effectively the same place as
        // one already in knownPlaces, so the dropdown doesn't show "Civil
        // Lines" twice.
        var knownNames = knownPlaces.Select(p => p.Name.ToLowerInvariant()).ToHashSet();
        suggestedPlaces = suggestedPlaces
            .Where(p => !knownNames.Contains(p.Name.ToLowerInvariant()))
            .ToList();

        return Ok(new PlaceSearchResponse(knownPlaces, suggestedPlaces));
    }

    /// <summary>
    /// Saves a place picked from the Nominatim "Other places" suggestions (or
    /// any free-typed name) into our own Place directory, returning its real
    /// ID — needed because route search only matches by Place ID, not raw
    /// coordinates. Safe to call repeatedly for the same name: idempotent,
    /// same find-or-create semantics as vehicle registration's internal helper.
    /// </summary>
    [HttpPost("resolve")]
    [AllowAnonymous]
    public async Task<ActionResult<PlaceDto>> Resolve(ResolvePlaceRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) return BadRequest("Name is required.");

        var id = await FindOrCreatePlace(request.Name, request.Latitude, request.Longitude);
        var place = await _db.Places.SingleAsync(p => p.Id == id);
        return Ok(new PlaceDto(place.Id, place.Code, place.Name, place.Latitude, place.Longitude));
    }

    private async Task<Guid> FindOrCreatePlace(string name, double? latitude, double? longitude)
    {
        var trimmed = NormalizePlaceName(name);

        var existing = await _db.Places.FirstOrDefaultAsync(p => EF.Functions.ILike(p.Name, trimmed));
        if (existing is not null)
        {
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
            throw;
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

    private static string NormalizePlaceName(string name) =>
        string.Join(' ', name.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
}
