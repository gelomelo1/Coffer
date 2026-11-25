using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace Coffer.BusinessLogic.Auth.OAuth
{
    public interface IGithubOAuthClient
    {
        string AuthorizeUrl(OAuthTransaction transaction);
        /// <summary>Exchanges the code and reads the account; <see cref="ProviderSignInException"/> on any failure.</summary>
        Task<ProviderIdentity> CompleteAsync(OAuthTransaction transaction, string code);
    }

    /// <summary>
    /// GitHub app sign-in: authorization code with PKCE S256 and state, confidential client (the secret stays on the
    /// backend). Identity is the immutable numeric GitHub id (never the login, which can be renamed and reused). The
    /// e-mail is kept only when it is the primary verified address. Only this sign-in's token is deleted afterwards; the
    /// authorization stays, so the next sign-in doesn't ask for consent again. (Coffer.Manager's device flow is separate.)
    /// </summary>
    public sealed class GithubOAuthClient : IGithubOAuthClient
    {
        private const string UserAgent = "Coffer";
        private readonly HttpClient _http;
        private readonly GithubAuthOptions _options;

        public GithubOAuthClient(HttpClient http, AuthOptions options)
        {
            _http = http;
            _options = options.Github;
        }

        public string AuthorizeUrl(OAuthTransaction t) =>
            "https://github.com/login/oauth/authorize" +
            $"?client_id={Uri.EscapeDataString(_options.ClientId)}" +
            $"&redirect_uri={Uri.EscapeDataString(_options.RedirectUri)}" +
            $"&scope={Uri.EscapeDataString("read:user user:email")}" +
            $"&state={Uri.EscapeDataString(t.State)}" +
            $"&code_challenge={Uri.EscapeDataString(FacebookOAuthClient.CodeChallenge(t.CodeVerifier!))}" +
            "&code_challenge_method=S256" +
            "&allow_signup=true";

        public async Task<ProviderIdentity> CompleteAsync(OAuthTransaction t, string code)
        {
            if (t.CodeVerifier == null) throw new ProviderSignInException("GitHub transaction without PKCE");
            if (string.IsNullOrWhiteSpace(code)) throw new ProviderSignInException("GitHub callback without code");
            try
            {
                var accessToken = await ExchangeAsync(t, code);
                try
                {
                    return await UserAsync(accessToken);
                }
                finally
                {
                    await RevokeAsync(accessToken);
                }
            }
            catch (Exception e) when (e is HttpRequestException or TaskCanceledException or JsonException or InvalidOperationException)
            {
                throw new ProviderSignInException($"GitHub sign-in failed: {e.GetType().Name}");
            }
        }

        private async Task<string> ExchangeAsync(OAuthTransaction t, string code)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://github.com/login/oauth/access_token")
            {
                Content = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["client_id"] = _options.ClientId,
                    ["client_secret"] = _options.ClientSecret,
                    ["code"] = code,
                    ["redirect_uri"] = _options.RedirectUri,
                    ["code_verifier"] = t.CodeVerifier!,
                }),
            };
            request.Headers.Accept.ParseAdd("application/json");
            using var response = await _http.SendAsync(request);
            if (!response.IsSuccessStatusCode) throw new ProviderSignInException($"GitHub token endpoint answered {(int)response.StatusCode}");
            using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            // GitHub reports a bad or expired code with 200 and an "error" field.
            if (json.RootElement.ValueKind != JsonValueKind.Object
                || !json.RootElement.TryGetProperty("access_token", out var token) || token.ValueKind != JsonValueKind.String
                || string.IsNullOrEmpty(token.GetString()))
                throw new ProviderSignInException("GitHub token response without access_token");
            return token.GetString()!;
        }

        private HttpRequestMessage Api(HttpMethod method, string url, string accessToken)
        {
            var request = new HttpRequestMessage(method, url);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            request.Headers.UserAgent.ParseAdd(UserAgent);
            request.Headers.Accept.ParseAdd("application/vnd.github+json");
            return request;
        }

        private async Task<ProviderIdentity> UserAsync(string accessToken)
        {
            using var userRequest = Api(HttpMethod.Get, "https://api.github.com/user", accessToken);
            using var userResponse = await _http.SendAsync(userRequest);
            if (!userResponse.IsSuccessStatusCode) throw new ProviderSignInException($"GitHub user endpoint answered {(int)userResponse.StatusCode}");
            using var user = JsonDocument.Parse(await userResponse.Content.ReadAsStringAsync());
            var root = user.RootElement;
            if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty("id", out var idValue)
                || idValue.ValueKind != JsonValueKind.Number || !idValue.TryGetInt64(out var id) || id <= 0)
                throw new ProviderSignInException("GitHub account without a valid id");
            var login = root.TryGetProperty("login", out var l) && l.ValueKind == JsonValueKind.String ? l.GetString() : null;
            var avatar = root.TryGetProperty("avatar_url", out var a) && a.ValueKind == JsonValueKind.String
                && Uri.TryCreate(a.GetString(), UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps
                ? uri.GetLeftPart(UriPartial.Path)
                : null;

            return new ProviderIdentity(Providers.Github, id.ToString(), await PrimaryVerifiedEmailAsync(accessToken), login, avatar);
        }

        private async Task<string?> PrimaryVerifiedEmailAsync(string accessToken)
        {
            using var request = Api(HttpMethod.Get, "https://api.github.com/user/emails", accessToken);
            using var response = await _http.SendAsync(request);
            if (!response.IsSuccessStatusCode) throw new ProviderSignInException($"GitHub e-mail endpoint answered {(int)response.StatusCode}");
            using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            if (json.RootElement.ValueKind != JsonValueKind.Array) throw new ProviderSignInException("GitHub e-mails are not a list");
            foreach (var entry in json.RootElement.EnumerateArray())
            {
                if (entry.ValueKind == JsonValueKind.Object
                    && entry.TryGetProperty("primary", out var p) && p.ValueKind == JsonValueKind.True
                    && entry.TryGetProperty("verified", out var v) && v.ValueKind == JsonValueKind.True
                    && entry.TryGetProperty("email", out var e) && e.ValueKind == JsonValueKind.String)
                    return e.GetString();
            }
            return null;
        }

        private async Task RevokeAsync(string accessToken)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Delete, $"https://api.github.com/applications/{Uri.EscapeDataString(_options.ClientId)}/token")
                {
                    Content = JsonContent.Create(new { access_token = accessToken }),
                };
                request.Headers.Authorization = new AuthenticationHeaderValue("Basic",
                    Convert.ToBase64String(Encoding.UTF8.GetBytes($"{_options.ClientId}:{_options.ClientSecret}")));
                request.Headers.UserAgent.ParseAdd(UserAgent);
                request.Headers.Accept.ParseAdd("application/vnd.github+json");
                using var _ = await _http.SendAsync(request);
            }
            catch (Exception e) when (e is HttpRequestException or TaskCanceledException)
            {
                // Best effort: the token is only used for these two reads.
            }
        }
    }
}
