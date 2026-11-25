using System.Text.Json;

namespace Coffer.BusinessLogic.Auth.OAuth
{
    public interface IGoogleOAuthClient
    {
        string AuthorizeUrl(OAuthTransaction transaction);
        /// <summary>Exchanges the code and verifies the ID token; <see cref="ProviderSignInException"/> on any failure.</summary>
        Task<ProviderIdentity> CompleteAsync(OAuthTransaction transaction, string code);
    }

    /// <summary>
    /// Google: OpenID Connect authorization code flow with PKCE S256, state and nonce, through Google's web endpoints
    /// (no Android SDK). Google redirects to the API's callback; the code is exchanged with the client secret and the
    /// server-held verifier, and the ID token is verified like Facebook's (RS256, Google's keys, issuer, audience,
    /// lifetime, nonce). Identity is the "sub"; the e-mail is kept only when Google marks it verified.
    /// </summary>
    public sealed class GoogleOAuthClient : IGoogleOAuthClient
    {
        public const string JwksUrl = "https://www.googleapis.com/oauth2/v3/certs";
        private static readonly string[] Issuers = { "https://accounts.google.com", "accounts.google.com" };

        private readonly HttpClient _http;
        private readonly GoogleAuthOptions? _settings;
        /// <summary>The provider's settings; it is switched off when they are missing (development only).</summary>
        private GoogleAuthOptions _options => _settings ?? throw new ProviderNotConfiguredException(Providers.Google);
        private readonly JwksCache _keys;

        public GoogleOAuthClient(HttpClient http, AuthOptions options, JwksCache keys)
        {
            _http = http;
            _settings = options.Google;
            _keys = keys;
        }

        public string AuthorizeUrl(OAuthTransaction t) =>
            "https://accounts.google.com/o/oauth2/v2/auth" +
            $"?client_id={Uri.EscapeDataString(_options.ClientId)}" +
            $"&redirect_uri={Uri.EscapeDataString(_options.RedirectUri)}" +
            "&response_type=code" +
            $"&scope={Uri.EscapeDataString("openid email profile")}" +
            $"&state={Uri.EscapeDataString(t.State)}" +
            $"&nonce={Uri.EscapeDataString(t.Nonce!)}" +
            $"&code_challenge={Uri.EscapeDataString(FacebookOAuthClient.CodeChallenge(t.CodeVerifier!))}" +
            "&code_challenge_method=S256" +
            "&prompt=select_account";

        public async Task<ProviderIdentity> CompleteAsync(OAuthTransaction t, string code)
        {
            if (t.Nonce == null || t.CodeVerifier == null) throw new ProviderSignInException("Google transaction without nonce/PKCE");
            if (string.IsNullOrWhiteSpace(code)) throw new ProviderSignInException("Google callback without code");

            var idToken = await ExchangeAsync(t, code);
            var claims = await OidcIdTokens.ValidateAsync(_http, _keys, "Google", JwksUrl, idToken, Issuers, _options.ClientId, t.Nonce);
            var sub = OidcIdTokens.Text(claims, "sub") ?? throw new ProviderSignInException("Google ID token without sub");
            // An unverified address is not proof of ownership: it is not stored.
            var verified = claims.TryGetValue("email_verified", out var v) && (v is true || v?.ToString() == "true");
            return new ProviderIdentity(Providers.Google, sub, verified ? OidcIdTokens.Text(claims, "email") : null,
                OidcIdTokens.Text(claims, "name"), OidcIdTokens.Text(claims, "picture"));
        }

        private async Task<string> ExchangeAsync(OAuthTransaction t, string code)
        {
            var form = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "authorization_code",
                ["code"] = code,
                ["client_id"] = _options.ClientId,
                ["client_secret"] = _options.ClientSecret,
                ["redirect_uri"] = _options.RedirectUri,
                ["code_verifier"] = t.CodeVerifier!,
            });
            try
            {
                using var response = await _http.PostAsync("https://oauth2.googleapis.com/token", form);
                if (!response.IsSuccessStatusCode) throw new ProviderSignInException($"Google token endpoint answered {(int)response.StatusCode}");
                using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
                if (json.RootElement.ValueKind != JsonValueKind.Object
                    || !json.RootElement.TryGetProperty("id_token", out var idToken) || idToken.ValueKind != JsonValueKind.String)
                    throw new ProviderSignInException("Google token response without id_token");
                // The access token is not needed and not kept: everything comes from the verified ID token.
                return idToken.GetString()!;
            }
            catch (Exception e) when (e is HttpRequestException or TaskCanceledException or JsonException)
            {
                throw new ProviderSignInException($"Google token exchange failed: {e.GetType().Name}");
            }
        }
    }
}
