using Coffer.BusinessLogic.Marketplace.Common;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Coffer.BusinessLogic.Auth.OAuth
{
    /// <summary>
    /// Providers' signing keys (JWKS), per URL, kept for 24 hours. A token signed with a key we don't know triggers one
    /// refetch, at most every 5 minutes, so key rotation is picked up and forged key ids can't flood the provider.
    /// </summary>
    public sealed class JwksCache
    {
        private static readonly TimeSpan MaxAge = TimeSpan.FromHours(24);
        private static readonly TimeSpan MinRefetchInterval = TimeSpan.FromMinutes(5);

        private readonly IClock _clock;
        private readonly SemaphoreSlim _gate = new(1, 1);
        private readonly Dictionary<string, (JsonWebKeySet Keys, DateTime FetchedAt)> _sets = new();

        public JwksCache(IClock clock) => _clock = clock;

        public async Task<JsonWebKeySet> GetAsync(HttpClient http, string jwksUrl, string? kid)
        {
            await _gate.WaitAsync();
            try
            {
                var now = _clock.UtcNow;
                var known = _sets.TryGetValue(jwksUrl, out var cached);
                var stale = !known || now - cached.FetchedAt > MaxAge;
                var unknownKid = known && kid != null && cached.Keys.Keys.All(k => k.Kid != kid) && now - cached.FetchedAt >= MinRefetchInterval;
                if (stale || unknownKid)
                {
                    using var response = await http.GetAsync(jwksUrl);
                    if (!response.IsSuccessStatusCode) throw new ProviderSignInException($"JWKS {jwksUrl} answered {(int)response.StatusCode}");
                    cached = (new JsonWebKeySet(await response.Content.ReadAsStringAsync()), now);
                    _sets[jwksUrl] = cached;
                }
                return cached.Keys;
            }
            finally
            {
                _gate.Release();
            }
        }
    }

    /// <summary>
    /// ID-token verification shared by the OIDC providers: RS256 only, signed with one of the provider's published keys,
    /// issuer, audience and lifetime (2 min skew) checked, and the nonce equal to the one of our transaction.
    /// </summary>
    public static class OidcIdTokens
    {
        public static async Task<IDictionary<string, object>> ValidateAsync(
            HttpClient http, JwksCache keys, string provider, string jwksUrl, string idToken, IEnumerable<string> issuers, string audience, string expectedNonce)
        {
            var handler = new JsonWebTokenHandler();
            string? kid;
            try
            {
                kid = handler.ReadJsonWebToken(idToken).Kid;
            }
            catch (Exception e) when (e is ArgumentException or SecurityTokenMalformedException)
            {
                throw new ProviderSignInException($"{provider} ID token is malformed");
            }

            JsonWebKeySet set;
            try
            {
                set = await keys.GetAsync(http, jwksUrl, kid);
            }
            catch (Exception e) when (e is HttpRequestException or TaskCanceledException or ArgumentException)
            {
                throw new ProviderSignInException($"{provider} signing keys unavailable: {e.GetType().Name}");
            }

            var result = await handler.ValidateTokenAsync(idToken, new TokenValidationParameters
            {
                ValidIssuers = issuers,
                ValidAudience = audience,
                IssuerSigningKeys = set.GetSigningKeys(),
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
                throw new ProviderSignInException($"{provider} ID token rejected: {result.Exception?.GetType().Name ?? "invalid"}");

            var nonce = result.Claims.TryGetValue("nonce", out var n) ? n?.ToString() : null;
            if (!SecureRandom.Same(nonce, expectedNonce))
                throw new ProviderSignInException($"{provider} ID token nonce mismatch");
            return result.Claims;
        }

        public static string? Text(IDictionary<string, object> claims, string name) =>
            claims.TryGetValue(name, out var value) && value is string text && !string.IsNullOrWhiteSpace(text) ? text : null;
    }
}
