using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Coffer.BusinessLogic.Marketplace.Common;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Coffer.BusinessLogic.Auth.OAuth
{
    public interface IFacebookOAuthClient
    {
        string AuthorizeUrl(OAuthTransaction transaction);
        /// <summary>Exchanges the code and verifies the ID token; <see cref="ProviderSignInException"/> on any failure.</summary>
        Task<ProviderIdentity> CompleteAsync(OAuthTransaction transaction, string code);
    }

    /// <summary>
    /// Facebook Login as an OIDC authorization code flow with PKCE S256 and a nonce. The code is exchanged with the app
    /// secret and the server-held verifier; identity is the ID token's "sub" (app-scoped Facebook user id) after the
    /// signature (RS256, Facebook's keys), issuer, audience, lifetime and nonce were checked.
    /// </summary>
    public sealed class FacebookOAuthClient : IFacebookOAuthClient
    {
        public const string Issuer = "https://www.facebook.com";
        public const string JwksUrl = "https://www.facebook.com/.well-known/oauth/openid/jwks/";

        private readonly HttpClient _http;
        private readonly FacebookAuthOptions? _settings;
        /// <summary>The provider's settings; it is switched off when they are missing (development only).</summary>
        private FacebookAuthOptions _options => _settings ?? throw new ProviderNotConfiguredException(Providers.Facebook);
        private readonly JwksCache _keys;

        public FacebookOAuthClient(HttpClient http, AuthOptions options, JwksCache keys)
        {
            _http = http;
            _settings = options.Facebook;
            _keys = keys;
        }

        public static string CodeChallenge(string verifier) => Base64UrlEncoder.Encode(SHA256.HashData(Encoding.ASCII.GetBytes(verifier)));

        public string AuthorizeUrl(OAuthTransaction t) =>
            $"https://www.facebook.com/{Uri.EscapeDataString(_options.GraphVersion)}/dialog/oauth" +
            $"?client_id={Uri.EscapeDataString(_options.AppId)}" +
            $"&redirect_uri={Uri.EscapeDataString(_options.RedirectUri)}" +
            "&response_type=code" +
            $"&scope={Uri.EscapeDataString("openid email public_profile")}" +
            $"&state={Uri.EscapeDataString(t.State)}" +
            $"&nonce={Uri.EscapeDataString(t.Nonce!)}" +
            $"&code_challenge={Uri.EscapeDataString(CodeChallenge(t.CodeVerifier!))}" +
            "&code_challenge_method=S256";

        public async Task<ProviderIdentity> CompleteAsync(OAuthTransaction t, string code)
        {
            if (t.Nonce == null || t.CodeVerifier == null) throw new ProviderSignInException("Facebook transaction without nonce/PKCE");
            if (string.IsNullOrWhiteSpace(code)) throw new ProviderSignInException("Facebook callback without code");

            var idToken = await ExchangeAsync(t, code);
            var claims = await OidcIdTokens.ValidateAsync(_http, _keys, "Facebook", JwksUrl, idToken, new[] { Issuer }, _options.AppId, t.Nonce);
            var sub = claims.TryGetValue("sub", out var s) ? s?.ToString() : null;
            if (string.IsNullOrWhiteSpace(sub)) throw new ProviderSignInException("Facebook ID token without sub");

            // Facebook doesn't state whether the address is verified: it is kept for display only, never to match accounts.
            return new ProviderIdentity(Providers.Facebook, sub, Text(claims, "email"), Text(claims, "name"), Text(claims, "picture"));
        }

        private async Task<string> ExchangeAsync(OAuthTransaction t, string code)
        {
            var form = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["client_id"] = _options.AppId,
                ["client_secret"] = _options.AppSecret,
                ["redirect_uri"] = _options.RedirectUri,
                ["code_verifier"] = t.CodeVerifier!,
                ["code"] = code,
            });
            try
            {
                using var response = await _http.PostAsync($"https://graph.facebook.com/{Uri.EscapeDataString(_options.GraphVersion)}/oauth/access_token", form);
                if (!response.IsSuccessStatusCode) throw new ProviderSignInException($"Facebook token endpoint answered {(int)response.StatusCode}");
                using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
                if (json.RootElement.ValueKind != JsonValueKind.Object
                    || !json.RootElement.TryGetProperty("id_token", out var idToken) || idToken.ValueKind != JsonValueKind.String)
                    throw new ProviderSignInException("Facebook token response without id_token");
                return idToken.GetString()!;
            }
            catch (Exception e) when (e is HttpRequestException or TaskCanceledException or JsonException)
            {
                throw new ProviderSignInException($"Facebook token exchange failed: {e.GetType().Name}");
            }
        }

        private static string? Text(IDictionary<string, object> claims, string name) =>
            claims.TryGetValue(name, out var value) && value is string text && !string.IsNullOrWhiteSpace(text) ? text : null;
    }
}
