using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Coffer.BusinessLogic.Auth.OAuth
{
    public interface IDiscordOAuthClient
    {
        string AuthorizeUrl(OAuthTransaction transaction);
        /// <summary>Exchanges the code and reads the account; <see cref="ProviderSignInException"/> on any failure.</summary>
        Task<ProviderIdentity> CompleteAsync(OAuthTransaction transaction, string code);
    }

    /// <summary>
    /// Discord: authorization code with PKCE S256 and state, confidential client (the secret stays on the backend).
    /// Identity is Discord's immutable user id (never the username, which can change). The e-mail is kept only when
    /// Discord says it is verified. Coffer needs nothing else from Discord, so its token is revoked right away.
    /// </summary>
    public sealed class DiscordOAuthClient : IDiscordOAuthClient
    {
        // Pinned API version (the unversioned path serves the deprecated v6). Discord requires a User-Agent.
        private const string Api = "https://discord.com/api/v10";
        private const string UserAgent = "Coffer (https://github.com/gelomelo1/Coffer, 1.0)";
        private readonly HttpClient _http;
        private readonly DiscordAuthOptions _options;

        public DiscordOAuthClient(HttpClient http, AuthOptions options)
        {
            _http = http;
            _options = options.Discord;
        }

        public string AuthorizeUrl(OAuthTransaction t) =>
            "https://discord.com/oauth2/authorize" +
            $"?client_id={Uri.EscapeDataString(_options.ClientId)}" +
            "&response_type=code" +
            $"&redirect_uri={Uri.EscapeDataString(_options.RedirectUri)}" +
            $"&scope={Uri.EscapeDataString("identify email")}" +
            $"&state={Uri.EscapeDataString(t.State)}" +
            $"&code_challenge={Uri.EscapeDataString(FacebookOAuthClient.CodeChallenge(t.CodeVerifier!))}" +
            "&code_challenge_method=S256" +
            "&prompt=consent";

        public async Task<ProviderIdentity> CompleteAsync(OAuthTransaction t, string code)
        {
            if (t.CodeVerifier == null) throw new ProviderSignInException("Discord transaction without PKCE");
            if (string.IsNullOrWhiteSpace(code)) throw new ProviderSignInException("Discord callback without code");
            try
            {
                var accessToken = await ExchangeAsync(t, code);
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
                throw new ProviderSignInException($"Discord sign-in failed: {e.GetType().Name}");
            }
        }

        private AuthenticationHeaderValue ClientCredentials() =>
            new("Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes($"{_options.ClientId}:{_options.ClientSecret}")));

        private async Task<string> ExchangeAsync(OAuthTransaction t, string code)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, $"{Api}/oauth2/token")
            {
                Content = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["grant_type"] = "authorization_code",
                    ["code"] = code,
                    ["redirect_uri"] = _options.RedirectUri,
                    ["code_verifier"] = t.CodeVerifier!,
                }),
            };
            request.Headers.Authorization = ClientCredentials();
            request.Headers.TryAddWithoutValidation("User-Agent", UserAgent);
            using var response = await _http.SendAsync(request);
            if (!response.IsSuccessStatusCode) throw new ProviderSignInException($"Discord token endpoint answered {(int)response.StatusCode}");
            using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            if (json.RootElement.ValueKind != JsonValueKind.Object
                || !json.RootElement.TryGetProperty("access_token", out var token) || token.ValueKind != JsonValueKind.String
                || string.IsNullOrEmpty(token.GetString()))
                throw new ProviderSignInException("Discord token response without access_token");
            return token.GetString()!;
        }

        private async Task<ProviderIdentity> MeAsync(string accessToken)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"{Api}/users/@me");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            request.Headers.TryAddWithoutValidation("User-Agent", UserAgent);
            using var response = await _http.SendAsync(request);
            if (!response.IsSuccessStatusCode) throw new ProviderSignInException($"Discord account endpoint answered {(int)response.StatusCode}");
            using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            var root = json.RootElement;
            if (root.ValueKind != JsonValueKind.Object) throw new ProviderSignInException("Discord account is not an object");

            var id = Text(root, "id");
            if (string.IsNullOrWhiteSpace(id) || !id.All(char.IsAsciiDigit)) throw new ProviderSignInException("Discord account without a valid id");
            var verified = root.TryGetProperty("verified", out var v) && v.ValueKind == JsonValueKind.True;
            var email = verified ? Text(root, "email") : null;
            var avatarHash = Text(root, "avatar");
            // Avatar hashes are hex (a_… for animated ones); anything else is not turned into a URL.
            var avatar = avatarHash != null && avatarHash.All(c => char.IsAsciiLetterOrDigit(c) || c == '_')
                ? $"https://cdn.discordapp.com/avatars/{id}/{avatarHash}.png"
                : null;
            return new ProviderIdentity(Providers.Discord, id, email, Text(root, "global_name") ?? Text(root, "username"), avatar);
        }

        private static string? Text(JsonElement root, string name) =>
            root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(value.GetString())
                ? value.GetString()
                : null;

        private async Task RevokeAsync(string accessToken)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, $"{Api}/oauth2/token/revoke")
                {
                    Content = new FormUrlEncodedContent(new Dictionary<string, string>
                    {
                        ["token"] = accessToken,
                        ["token_type_hint"] = "access_token",
                    }),
                };
                request.Headers.Authorization = ClientCredentials();
                request.Headers.TryAddWithoutValidation("User-Agent", UserAgent);
                using var _ = await _http.SendAsync(request);
            }
            catch (Exception e) when (e is HttpRequestException or TaskCanceledException)
            {
                // Best effort: the token only has the identify/email scopes.
            }
        }
    }
}
