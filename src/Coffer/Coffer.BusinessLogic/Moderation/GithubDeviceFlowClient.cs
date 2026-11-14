using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Coffer.BusinessLogic.Moderation
{
    public sealed record GithubDeviceCode(string DeviceCode, string UserCode, string VerificationUri, int ExpiresIn, int Interval);

    public enum GithubDevicePollStatus { Pending, SlowDown, Expired, Denied, Disabled, Failed, Authorized }

    public sealed record GithubDevicePoll(GithubDevicePollStatus Status, string? AccessToken = null, string? Error = null);

    public sealed record GithubIdentity(string Id, string Login);

    /// <summary>GitHub OAuth Device Flow (no redirect, no client secret) — the fit for a desktop admin tool.</summary>
    public interface IGithubDeviceFlowClient
    {
        Task<GithubDeviceCode> StartAsync(CancellationToken ct = default);
        Task<GithubDevicePoll> PollAsync(string deviceCode, CancellationToken ct = default);
        Task<GithubIdentity> GetUserAsync(string accessToken, CancellationToken ct = default);
    }

    public sealed class GithubDeviceFlowClient : IGithubDeviceFlowClient
    {
        // Same public OAuth app the mobile app uses (GithubService); "Enable Device Flow" must be ticked on it.
        private const string DefaultClientId = "Ov23liTJaxWIA5j85V7M";
        private readonly HttpClient _http;

        public GithubDeviceFlowClient(HttpClient http)
        {
            _http = http;
        }

        public static string ClientId =>
            FirstSet("COFFER_MANAGER_GITHUB_CLIENT_ID", "GITHUB_CLIENT_ID") ?? DefaultClientId;

        public async Task<GithubDeviceCode> StartAsync(CancellationToken ct = default)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://github.com/login/device/code")
            {
                Content = new FormUrlEncodedContent(new Dictionary<string, string> { ["client_id"] = ClientId, ["scope"] = "read:user" }),
            };
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            using var response = await _http.SendAsync(request, ct);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
            if (!response.IsSuccessStatusCode || body.TryGetProperty("error", out _))
            {
                var error = body.ValueKind == JsonValueKind.Object && body.TryGetProperty("error", out var e) ? e.GetString() : $"HTTP {(int)response.StatusCode}";
                throw new GithubDeviceFlowException(error ?? "unknown_error");
            }

            return new GithubDeviceCode(
                body.GetProperty("device_code").GetString()!,
                body.GetProperty("user_code").GetString()!,
                body.GetProperty("verification_uri").GetString()!,
                body.GetProperty("expires_in").GetInt32(),
                body.TryGetProperty("interval", out var interval) ? interval.GetInt32() : 5);
        }

        public async Task<GithubDevicePoll> PollAsync(string deviceCode, CancellationToken ct = default)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://github.com/login/oauth/access_token")
            {
                Content = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["client_id"] = ClientId,
                    ["device_code"] = deviceCode,
                    ["grant_type"] = "urn:ietf:params:oauth:grant-type:device_code",
                }),
            };
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            using var response = await _http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
                return new GithubDevicePoll(GithubDevicePollStatus.Failed, Error: $"HTTP {(int)response.StatusCode}");

            var body = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
            if (body.TryGetProperty("access_token", out var token) && !string.IsNullOrEmpty(token.GetString()))
                return new GithubDevicePoll(GithubDevicePollStatus.Authorized, token.GetString());

            var error = body.TryGetProperty("error", out var e) ? e.GetString() : null;
            return error switch
            {
                "authorization_pending" => new GithubDevicePoll(GithubDevicePollStatus.Pending),
                "slow_down" => new GithubDevicePoll(GithubDevicePollStatus.SlowDown),
                "expired_token" => new GithubDevicePoll(GithubDevicePollStatus.Expired),
                "access_denied" => new GithubDevicePoll(GithubDevicePollStatus.Denied),
                "device_flow_disabled" => new GithubDevicePoll(GithubDevicePollStatus.Disabled),
                _ => new GithubDevicePoll(GithubDevicePollStatus.Failed, Error: error ?? "unknown_error"),
            };
        }

        public async Task<GithubIdentity> GetUserAsync(string accessToken, CancellationToken ct = default)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, "https://api.github.com/user");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            request.Headers.UserAgent.ParseAdd("CofferManager");
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
            using var response = await _http.SendAsync(request, ct);
            response.EnsureSuccessStatusCode();
            var body = await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
            // "id" is GitHub's immutable numeric account id; "login" can change and is display-only.
            return new GithubIdentity(body.GetProperty("id").GetRawText(), body.GetProperty("login").GetString() ?? "");
        }

        private static string? FirstSet(params string[] names) =>
            names.Select(Environment.GetEnvironmentVariable).FirstOrDefault(v => !string.IsNullOrWhiteSpace(v));
    }

    public sealed class GithubDeviceFlowException : Exception
    {
        public string Error { get; }

        public GithubDeviceFlowException(string error) : base($"GitHub device flow failed: {error}")
        {
            Error = error;
        }
    }
}
