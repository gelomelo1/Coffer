using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Coffer.BusinessLogic.Marketplace.Common;
using Microsoft.IdentityModel.Tokens;

namespace Coffer.BusinessLogic.Auth.Sessions
{
    /// <summary>
    /// Short-lived app access tokens (15 minutes, HS256). They carry only the user id and the session id; the session
    /// is checked on every request, so a revoked session ends its tokens at once.
    /// </summary>
    public sealed class AccessTokenIssuer
    {
        public const string Issuer = "coffer.backend";
        public const string Audience = "coffer.backend";
        public const string SessionClaim = "sid";
        public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(15);

        private readonly SymmetricSecurityKey _key;
        private readonly IClock _clock;

        public AccessTokenIssuer(AuthOptions options, IClock clock)
        {
            _key = new SymmetricSecurityKey(options.JwtKey);
            _clock = clock;
        }

        public (string Token, DateTime ExpiresAt) Issue(Guid userId, Guid sessionId)
        {
            var now = _clock.UtcNow;
            var expires = now.Add(Lifetime);
            var token = new JwtSecurityToken(
                issuer: Issuer,
                audience: Audience,
                claims: new[]
                {
                    new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
                    new Claim(SessionClaim, sessionId.ToString()),
                    new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                    new Claim(JwtRegisteredClaimNames.Iat, EpochTime.GetIntDate(now).ToString(), ClaimValueTypes.Integer64),
                },
                notBefore: now,
                expires: expires,
                signingCredentials: new SigningCredentials(_key, SecurityAlgorithms.HmacSha256));
            return (new JwtSecurityTokenHandler().WriteToken(token), expires);
        }

        /// <summary>How the API checks user tokens: only HS256, signed, with an expiry, 30 s clock skew.</summary>
        public static TokenValidationParameters ValidationParameters(byte[] key) => new()
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            RequireExpirationTime = true,
            RequireSignedTokens = true,
            ValidIssuer = Issuer,
            ValidAudience = Audience,
            ValidAlgorithms = new[] { SecurityAlgorithms.HmacSha256 },
            IssuerSigningKey = new SymmetricSecurityKey(key),
            ClockSkew = TimeSpan.FromSeconds(30),
        };

        /// <summary>The session id of a validated user token (claim mapping may rename "sid"), or null.</summary>
        public static Guid? SessionId(ClaimsPrincipal user)
        {
            var value = user.FindFirst(SessionClaim)?.Value ?? user.FindFirst(ClaimTypes.Sid)?.Value;
            return Guid.TryParse(value, out var id) ? id : null;
        }
    }
}
