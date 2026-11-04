using System.Text.Json;

namespace VehicleTracking.Api.Services;

public class PushNotificationService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<PushNotificationService> _logger;

    public PushNotificationService(HttpClient httpClient, ILogger<PushNotificationService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task SendAsync(IEnumerable<string> pushTokens, string title, string body, object? data = null)
    {
        var tokens = pushTokens.Where(t => !string.IsNullOrWhiteSpace(t)).Distinct().ToList();
        if (tokens.Count == 0) return;

        var messages = tokens.Select(token => new
        {
            to = token,
            title,
            body,
            data,
            sound = "default",
        });

        try
        {
            var response = await _httpClient.PostAsJsonAsync("https://exp.host/--/api/v2/push/send", messages);
            if (!response.IsSuccessStatusCode)
            {
                var text = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("Push notification send failed: {Status} {Body}", response.StatusCode, text);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Push notification send threw an exception");
        }
    }
}
