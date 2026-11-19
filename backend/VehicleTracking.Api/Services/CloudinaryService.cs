using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;

namespace VehicleTracking.Api.Services;

/// <summary>
/// Uploads driver verification document photos (DL, Aadhaar, RC, profile
/// photo) to Cloudinary's free tier via its signed upload REST API. No
/// Cloudinary SDK dependency - a signed multipart POST is simple enough to
/// build directly with HttpClient, matching this project's lean-dependency
/// convention (same as NominatimGeocodingService).
/// </summary>
public class CloudinaryService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<CloudinaryService> _logger;
    private readonly string _cloudName;
    private readonly string _apiKey;
    private readonly string _apiSecret;

    public CloudinaryService(HttpClient httpClient, ILogger<CloudinaryService> logger, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _logger = logger;
        _cloudName = configuration["Cloudinary:CloudName"] ?? "";
        _apiKey = configuration["Cloudinary:ApiKey"] ?? "";
        _apiSecret = configuration["Cloudinary:ApiSecret"] ?? "";
    }

    /// <summary>
    /// Uploads one file and returns its public HTTPS URL, or null if the
    /// upload failed (caller decides whether that's fatal for the request).
    /// </summary>
    public async Task<string?> UploadAsync(Stream fileStream, string fileName, string folder, CancellationToken cancellationToken = default)
    {
        if (_cloudName.Length == 0 || _apiKey.Length == 0 || _apiSecret.Length == 0)
        {
            _logger.LogWarning("Cloudinary is not configured - upload skipped for {FileName}", fileName);
            return null;
        }

        try
        {
            var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();

            // Cloudinary's signature is a SHA1 hash of every non-file
            // parameter, sorted alphabetically by key, joined as
            // "key=value&key=value", with the API secret appended - per
            // Cloudinary's documented signed-upload scheme.
            var paramsToSign = $"folder={folder}&timestamp={timestamp}{_apiSecret}";
            var signature = Convert.ToHexString(SHA1.HashData(Encoding.UTF8.GetBytes(paramsToSign))).ToLowerInvariant();

            using var content = new MultipartFormDataContent();
            using var streamContent = new StreamContent(fileStream);
            content.Add(streamContent, "file", fileName);
            content.Add(new StringContent(_apiKey), "api_key");
            content.Add(new StringContent(timestamp), "timestamp");
            content.Add(new StringContent(folder), "folder");
            content.Add(new StringContent(signature), "signature");

            var response = await _httpClient.PostAsync(
                $"https://api.cloudinary.com/v1_1/{_cloudName}/image/upload", content, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogWarning("Cloudinary upload failed: {Status} {Body}", response.StatusCode, body);
                return null;
            }

            var result = await response.Content.ReadFromJsonAsync<CloudinaryUploadResult>(cancellationToken: cancellationToken);
            return result?.SecureUrl;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cloudinary upload threw an exception for {FileName}", fileName);
            return null;
        }
    }

    private class CloudinaryUploadResult
    {
        [JsonPropertyName("secure_url")]
        public string? SecureUrl { get; set; }
    }
}
