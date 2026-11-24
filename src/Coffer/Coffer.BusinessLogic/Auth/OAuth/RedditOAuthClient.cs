using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Coffer.BusinessLogic.Auth.OAuth
{
    public interface IRedditOAuthClient
    {
        string AuthorizeUrl(OAuthTransaction transaction);
        /// <summary>Exchanges the code and reads the account; <see cref="ProviderSignInException"/> on any failure.</summary>
        Task<ProviderIdentity> CompleteAsync(string code);
    }

    /// <summary>
    /// Reddit has no OIDC and no PKCE, so the app is a confidential "web app": the code is only worth something together
    /// with the client secret, which only the backend has. The state is checked by the backend-held transaction.
    /// Identity is Reddit's immutable account id (never the username, which can be reused after deletion). Coffer only
    /// needs the id, so the Reddit token is revoked right away. Reddit gives no e-mail address.
    /// </summary>
    public sealed class RedditOAuthClient : IRedditOAuthClient
    {
        private readonly HttpClient _http;
        private readonly RedditAuthOptions _options;

        public RedditOAuthClient(HttpClient http, AuthOptions options)
        {
            _http = http;
            _options = options.Reddit;
        }

        public string AuthorizeUrl(OAuthTransaction t) =>
            "https://www.reddit.com/api/v1/authorize.compact" +
            $"?client_id={Uri.EscapeDataString(_options.ClientId)}" +
            "&response_type=code" +
            $"&state={Uri.EscapeDataString(t.State)}" +
            $"&redirect_uri={Uri.EscapeDataString(_options.RedirectUri)}" +
            "&duration=temporary" +
            "&scope=identity";

        public async Task<ProviderIdentity> CompleteAsync(string code)
        {
            if (string.IsNullOrWhiteSpace(code)) throw new ProviderSignInException("Reddit callback without code");
            try
            {
                var accessToken = await ExchangeAsync(code);
                try
                {
                    return await MeAsync(accessToken);
                }
                finally
                {
                    await RevokeAsync(accessToken);
                }
            }
            catch (Exception e) when (e is HttpRequestException or TaskCanceledException or JsonException or InvalidOperationException)
            {
                throw new ProviderSignInException($"Reddit sign-in failed: {e.GetType().Name}");
            }
        }

        private HttpRequestMessage Request(HttpMethod method, string url, HttpContent? content = null)
        {
            var request = new HttpRequestMessage(method, url) { Content = content };
            // Reddit asks for "platform:app id:version (by /u/name)", which is not a strict HTTP product token.
            request.Headers.TryAddWithoutValidation("User-Agent", _options.UserAgent);
            return request;
        }

        private AuthenticationHeaderValue ClientCredentials() =>
            new("Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes($"{_options.ClientId}:{_options.ClientSecret}")));

        private async Task<string> ExchangeAsync(string code)
        {
            using var request = Request(HttpMethod.Post, "https://www.reddit.com/api/v1/access_token", new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "authorization_code",
                ["code"] = code,
                ["redirect_uri"] = _options.RedirectUri,
            }));
            request.Headers.Authorization = ClientCredentials();
            using var response = await _http.SendAsync(request);
            if (!response.IsSuccessStatusCode) throw new ProviderSignInException($"Reddit token endpoint answered {(int)response.StatusCode}");
            using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            // Reddit reports errors such as invalid_grant with 200 and an "error" field.
            if (json.RootElement.ValueKind != JsonValueKind.Object
                || !json.RootElement.TryGetProperty("access_token", out var token) || token.ValueKind != JsonValueKind.String
                || string.IsNullOrEmpty(token.GetString()))
                throw new ProviderSignInException("Reddit token response without access_token");
            return token.GetString()!;
        }

        private async Task<ProviderIdentity> MeAsync(string accessToken)
        {
            using var request = Request(HttpMethod.Get, "https://oauth.reddit.com/api/v1/me");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            using var response = await _http.SendAsync(request);
            if (!response.IsSuccessStatusCode) throw new ProviderSignInException($"Reddit account endpoint answered {(int)response.StatusCode}");
            using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            var root = json.RootElement;
            var id = root.ValueKind == JsonValueKind.Object && root.TryGetProperty("id", out var i) && i.ValueKind == JsonValueKind.String ? i.GetString() : null;
            if (string.IsNullOrWhiteSpace(id)) throw new ProviderSignInException("Reddit account without id");
            var name = root.TryGetProperty("name", out var n) && n.ValueKind == JsonValueKind.String ? n.GetString() : null;
            var icon = root.TryGetProperty("icon_img", out var a) && a.ValueKind == JsonValueKind.String ? Avatar(a.GetString()) : null;
            return new ProviderIdentity(Providers.Reddit, id, null, name, icon);
        }

        /// <summary>Only an https image URL is kept, without Reddit's (HTML-escaped) query string.</summary>
        private static string? Avatar(string? url) =>
            Uri.TryCreate(url, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps ? uri.GetLeftPart(UriPartial.Path) : null;

        private async Task RevokeAsync(string accessToken)
        {
            try
            {
                using var request = Request(HttpMethod.Post, "https://www.reddit.com/api/v1/revoke_token", new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["token"] = accessToken,
                    ["token_type_hint"] = "access_token",
                }));
                request.Headers.Authorization = ClientCredentials();
                using var _ = await _http.SendAsync(request);
            }
            catch (Exception e) when (e is HttpRequestException or TaskCanceledException)
            {
                // Best effort: the token is short-lived ("temporary") and only has the identity scope.
            }
        }
    }
}
