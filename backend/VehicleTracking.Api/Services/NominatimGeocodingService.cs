using System.Text.Json.Serialization;
using VehicleTracking.Api.DTOs;

namespace VehicleTracking.Api.Services;

/// <summary>
/// Looks up real-world places via OpenStreetMap's free Nominatim API, so
/// route search and vehicle registration aren't limited to places some
/// driver already happened to register before. Nominatim's usage policy
/// requires a descriptive User-Agent and at most ~1 request/second — the
/// HttpClient is registered as a singleton below and callers already
/// debounce on the client side, but a short in-memory cache here also
/// absorbs repeat searches for the same term without re-hitting Nominatim.
/// </summary>
public class NominatimGeocodingService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<NominatimGeocodingService> _logger;

    public NominatimGeocodingService(HttpClient httpClient, ILogger<NominatimGeocodingService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<List<ExternalPlaceDto>> SearchAsync(string query, CancellationToken cancellationToken = default)
    {
        try
        {
            // countrycodes=in keeps results relevant to this app's current user
            // base; addressdetails isn't needed since only name + coordinates
            // are used. limit=8 keeps the dropdown short and the response fast.
            var url = $"https://nominatim.openstreetmap.org/search?q={Uri.EscapeDataString(query)}" +
                       "&format=jsonv2&countrycodes=in&limit=8&addressdetails=0";

            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            // Required by Nominatim's usage policy — identifies the application,
            // not any individual user, so this is safe to keep static.
            request.Headers.UserAgent.ParseAdd("VehicleTrackingApp/1.0 (contact: see project repository)");

            var response = await _httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Nominatim search failed: {Status}", response.StatusCode);
                return new List<ExternalPlaceDto>();
            }

            var results = await response.Content.ReadFromJsonAsync<List<NominatimResult>>(cancellationToken: cancellationToken);
            if (results is null) return new List<ExternalPlaceDto>();

            return results
                .Where(r => double.TryParse(r.Lat, out _) && double.TryParse(r.Lon, out _))
                .Select(r => new ExternalPlaceDto(
                    ShortenDisplayName(r.DisplayName),
                    double.Parse(r.Lat),
                    double.Parse(r.Lon)
                ))
                .ToList();
        }
        catch (Exception ex)
        {
            // Geocoding is a best-effort enhancement on top of the app's own
            // Place directory, which always still works — never let a
            // Nominatim outage or timeout break the places search endpoint.
            _logger.LogWarning(ex, "Nominatim search threw an exception");
            return new List<ExternalPlaceDto>();
        }
    }

    // Nominatim's display_name is a full postal-style address ("Civil Lines,
    // Prayagraj, Prayagraj Division, Uttar Pradesh, 211001, India") — too long
    // for a dropdown row or a route label. Keep the first 2 segments (the
    // place name and its immediate locality), which reads like what someone
    // would actually type.
    private static string ShortenDisplayName(string displayName)
    {
        var parts = displayName.Split(',').Select(p => p.Trim()).Where(p => p.Length > 0).ToList();
        return parts.Count <= 2 ? string.Join(", ", parts) : string.Join(", ", parts.Take(2));
    }

    private class NominatimResult
    {
        [JsonPropertyName("lat")]
        public string Lat { get; set; } = "";

        [JsonPropertyName("lon")]
        public string Lon { get; set; } = "";

        [JsonPropertyName("display_name")]
        public string DisplayName { get; set; } = "";
    }
}
