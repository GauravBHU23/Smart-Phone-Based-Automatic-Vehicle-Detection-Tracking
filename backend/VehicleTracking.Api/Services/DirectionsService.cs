using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Caching.Memory;
using VehicleTracking.Api.DTOs;

namespace VehicleTracking.Api.Services;

/// <summary>
/// Fetches a real road route (not a straight line) between two points via
/// Google's Routes API (the legacy Directions API isn't offered on newer
/// Cloud projects - Routes API is Google's current replacement, same
/// underlying routing engine), server-side so neither client platform's
/// restricted Maps key has to handle a REST call it might not be allowed to
/// make. Short-lived in-memory cache keyed on coordinates rounded to ~100m,
/// since a driver's position moves gradually - re-billing Google on every
/// single 5s location ping for a route that's barely changed would be
/// wasteful and isn't needed for a usable line.
/// </summary>
public class DirectionsService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<DirectionsService> _logger;
    private readonly IMemoryCache _cache;
    private readonly string _apiKey;

    public DirectionsService(HttpClient httpClient, ILogger<DirectionsService> logger, IMemoryCache cache, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _logger = logger;
        _cache = cache;
        _apiKey = configuration["GoogleMaps:ServerApiKey"] ?? "";
    }

    public async Task<DirectionsResponse?> GetRouteAsync(double originLat, double originLng, double destLat, double destLng, CancellationToken cancellationToken = default)
    {
        if (_apiKey.Length == 0)
        {
            _logger.LogWarning("GoogleMaps:ServerApiKey is not configured - directions request skipped");
            return null;
        }

        // ~100m grid - coarse enough to absorb repeated pings from a
        // slow-moving vehicle, fine enough that the route still looks right.
        var cacheKey = $"directions:{Math.Round(originLat, 3)}:{Math.Round(originLng, 3)}:{Math.Round(destLat, 3)}:{Math.Round(destLng, 3)}";
        if (_cache.TryGetValue(cacheKey, out DirectionsResponse? cached))
        {
            return cached;
        }

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://routes.googleapis.com/directions/v2:computeRoutes");
            request.Headers.Add("X-Goog-Api-Key", _apiKey);
            // Routes API returns nothing unless you explicitly ask for it -
            // this is the minimum set of fields this app actually uses.
            request.Headers.Add("X-Goog-FieldMask", "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline");
            request.Content = JsonContent.Create(new
            {
                origin = new { location = new { latLng = new { latitude = originLat, longitude = originLng } } },
                destination = new { location = new { latLng = new { latitude = destLat, longitude = destLng } } },
                travelMode = "DRIVE",
            });

            var response = await _httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogWarning("Routes API request failed: {Status} {Body}", response.StatusCode, body);
                return null;
            }

            var result = await response.Content.ReadFromJsonAsync<GoogleRoutesResult>(cancellationToken: cancellationToken);
            var route = result?.Routes?.FirstOrDefault();
            if (route is null)
            {
                return null;
            }

            var polyline = DecodePolyline(route.Polyline?.EncodedPolyline ?? "");
            // Google returns duration as a string like "812s", not a number.
            var durationSeconds = double.TryParse(route.Duration?.TrimEnd('s'), out var seconds) ? seconds : 0;

            var directionsResponse = new DirectionsResponse(
                polyline,
                Math.Round(route.DistanceMeters / 1000.0, 2),
                (int)Math.Ceiling(durationSeconds / 60.0)
            );

            _cache.Set(cacheKey, directionsResponse, TimeSpan.FromSeconds(20));
            return directionsResponse;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Directions request threw an exception");
            return null;
        }
    }

    // Google's polyline encoding algorithm - a well-known, standard format,
    // no external package needed to decode it.
    private static List<LatLngDto> DecodePolyline(string encoded)
    {
        var points = new List<LatLngDto>();
        if (encoded.Length == 0) return points;

        int index = 0, lat = 0, lng = 0;
        while (index < encoded.Length)
        {
            int result = 0, shift = 0;
            int b;
            do
            {
                b = encoded[index++] - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            int dLat = (result & 1) != 0 ? ~(result >> 1) : result >> 1;
            lat += dLat;

            result = 0;
            shift = 0;
            do
            {
                b = encoded[index++] - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            int dLng = (result & 1) != 0 ? ~(result >> 1) : result >> 1;
            lng += dLng;

            points.Add(new LatLngDto(lat / 1e5, lng / 1e5));
        }
        return points;
    }

    private class GoogleRoutesResult
    {
        [JsonPropertyName("routes")]
        public List<GoogleRoute>? Routes { get; set; }
    }

    private class GoogleRoute
    {
        [JsonPropertyName("distanceMeters")]
        public double DistanceMeters { get; set; }

        // e.g. "812s" - Routes API encodes durations as a string, not a number.
        [JsonPropertyName("duration")]
        public string? Duration { get; set; }

        [JsonPropertyName("polyline")]
        public GooglePolyline? Polyline { get; set; }
    }

    private class GooglePolyline
    {
        [JsonPropertyName("encodedPolyline")]
        public string? EncodedPolyline { get; set; }
    }
}
