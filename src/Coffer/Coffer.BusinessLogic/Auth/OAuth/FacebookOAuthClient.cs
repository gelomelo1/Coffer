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
    /// Facebook's signing keys (JWKS), kept for 24 hours. A token signed with a key we don't know triggers one refetch,
    /// at most every 5 minutes, so Facebook's key rotation is picked up and forged key ids can't flood Facebook.
    /// </summary>
    public sealed class FacebookSigningKeys
    {
        public const string JwksUrl = "https://www.facebook.com/.well-known/oauth/openid/jwks/";
        private static readonly TimeSpan MaxAge = TimeSpan.FromHours(24);
        private static readonly TimeSpan MinRefetchInterval = TimeSpan.FromMinutes(5);

        private readonly IClock _clock;
        private readonly SemaphoreSlim _gate = new(1, 1);
        private JsonWebKeySet? _keys;
        private DateTime _fetchedAt;

        public FacebookSigningKeys(IClock clock) => _clock = clock;

        public async Task<JsonWebKeySet> GetAsync(HttpClient http, string? kid)
        {
            await _gate.WaitAsync();
            try
            {
                var now = _clock.UtcNow;
                var stale = _keys == null || now - _fetchedAt > MaxAge;
                var unknownKid = _keys != null && kid != null && _keys.Keys.All(k => k.Kid != kid) && now - _fetchedAt >= MinRefetchInterval;
                if (stale || unknownKid)
                {
                    using var response = await http.GetAsync(JwksUrl);
                    if (!response.IsSuccessStatusCode) throw new ProviderSignInException($"Facebook JWKS answered {(int)response.StatusCode}");
                    _keys = new JsonWebKeySet(await response.Content.ReadAsStringAsync());
                    _fetchedAt = now;
                }
                return _keys!;
            }
            finally
            {
                _gate.Release();
            }
        }
    }

    /// <summary>
    /// Facebook Login as an OIDC authorization code flow with PKCE S256 and a nonce. The code is exchanged with the app
    /// secret and the server-held verifier; identity is the ID token's "sub" (app-scoped Facebook user id) after the
    /// signature (RS256, Facebook's keys), issuer, audience, lifetime and nonce were checked.
    /// </summary>
    public sealed class FacebookOAuthClient : IFacebookOAuthClient
    {
        public const string Issuer = "https://www.facebook.com";

        private readonly HttpClient _http;
        private readonly FacebookAuthOptions _options;
        private readonly FacebookSigningKeys _keys;

        public FacebookOAuthClient(HttpClient http, AuthOptions options, FacebookSigningKeys keys)
        {
            _http = http;
            _options = options.Facebook;
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
            var claims = await ValidateAsync(idToken);

            if (!SecureRandom.Same(claims.TryGetValue("nonce", out var nonce) ? nonce?.ToString() : null, t.Nonce))
                throw new ProviderSignInException("Facebook ID token nonce mismatch");
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

        private async Task<IDictionary<string, object>> ValidateAsync(string idToken)
        {
            var handler = new JsonWebTokenHandler();
            string? kid;
            try
            {
                kid = handler.ReadJsonWebToken(idToken).Kid;
            }
            catch (Exception e) when (e is ArgumentException or SecurityTokenMalformedException)
            {
                throw new ProviderSignInException("Facebook ID token is malformed");
            }

            JsonWebKeySet keys;
            try
            {
                keys = await _keys.GetAsync(_http, kid);
            }
            catch (Exception e) when (e is HttpRequestException or TaskCanceledException or ArgumentException)
            {
                throw new ProviderSignInException($"Facebook signing keys unavailable: {e.GetType().Name}");
            }

            var result = await handler.ValidateTokenAsync(idToken, new TokenValidationParameters
            {
                ValidIssuer = Issuer,
                ValidAudience = _options.AppId,
                IssuerSigningKeys = keys.GetSigningKeys(),
                ValidAlgorithms = new[] { SecurityAlgorithms.RsaSha256 },
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                RequireExpirationTime = true,
                RequireSignedTokens = true,
                ClockSkew = TimeSpan.FromMinutes(2),
            });
            if (!result.IsValid)
                throw new ProviderSignInException($"Facebook ID token rejected: {result.Exception?.GetType().Name ?? "invalid"}");
            return result.Claims;
        }

        private static string? Text(IDictionary<string, object> claims, string name) =>
            claims.TryGetValue(name, out var value) && value is string text && !string.IsNullOrWhiteSpace(text) ? text : null;
    }
}
