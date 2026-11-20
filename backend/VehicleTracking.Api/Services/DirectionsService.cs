using System.Text.Json.Serialization;
using Microsoft.Extensions.Caching.Memory;
using VehicleTracking.Api.DTOs;

namespace VehicleTracking.Api.Services;

/// <summary>
/// Fetches a real road route (not a straight line) between two points via
/// Google's Directions API, server-side so neither client platform's
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
            var url = "https://maps.googleapis.com/maps/api/directions/json" +
                       $"?origin={originLat},{originLng}&destination={destLat},{destLng}&key={_apiKey}";

            var response = await _httpClient.GetAsync(url, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Directions request failed: {Status}", response.StatusCode);
                return null;
            }

            var result = await response.Content.ReadFromJsonAsync<GoogleDirectionsResult>(cancellationToken: cancellationToken);
            var route = result?.Routes?.FirstOrDefault();
            var leg = route?.Legs?.FirstOrDefault();
            if (route is null || leg is null)
            {
                if (result?.Status is not null && result.Status != "OK")
                {
                    _logger.LogWarning("Directions API returned status {Status}", result.Status);
                }
                return null;
            }

            var polyline = DecodePolyline(route.OverviewPolyline?.Points ?? "");
            var directionsResponse = new DirectionsResponse(
                polyline,
                Math.Round(leg.Distance.Value / 1000.0, 2),
                (int)Math.Ceiling(leg.Duration.Value / 60.0)
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

    private class GoogleDirectionsResult
    {
        [JsonPropertyName("status")]
        public string? Status { get; set; }

        [JsonPropertyName("routes")]
        public List<GoogleRoute>? Routes { get; set; }
    }

    private class GoogleRoute
    {
        [JsonPropertyName("legs")]
        public List<GoogleLeg>? Legs { get; set; }

        [JsonPropertyName("overview_polyline")]
        public GoogleOverviewPolyline? OverviewPolyline { get; set; }
    }

    private class GoogleLeg
    {
        [JsonPropertyName("distance")]
        public GoogleValueField Distance { get; set; } = new();

        [JsonPropertyName("duration")]
        public GoogleValueField Duration { get; set; } = new();
    }

    private class GoogleValueField
    {
        [JsonPropertyName("value")]
        public double Value { get; set; }
    }

    private class GoogleOverviewPolyline
    {
        [JsonPropertyName("points")]
        public string? Points { get; set; }
    }
}
