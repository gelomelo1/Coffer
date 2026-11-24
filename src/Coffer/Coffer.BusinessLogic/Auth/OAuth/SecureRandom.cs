using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace Coffer.BusinessLogic.Auth.OAuth
{
    /// <summary>Unguessable handles (refresh tokens, OAuth state, nonce, PKCE verifier, registration ids).</summary>
    public static class SecureRandom
    {
        /// <summary>32 bytes from the OS CSPRNG, base64url without padding (43 characters).</summary>
        public static string Token() => Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(32));

        /// <summary>Lowercase hex SHA-256 of the UTF-8 text (how refresh tokens are stored).</summary>
        public static string Sha256Hex(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();

        /// <summary>Constant-time comparison of two handles (no early exit that would leak a matching prefix).</summary>
        public static bool Same(string? a, string? b) =>
            a != null && b != null && CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(a), Encoding.UTF8.GetBytes(b));
    }
}
