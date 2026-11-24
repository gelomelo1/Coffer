using System.Text;

namespace Coffer.BusinessLogic.Auth
{
    /// <summary>Google ID tokens are only accepted when their "aud" is one of these client ids.</summary>
    public sealed record GoogleAuthOptions(IReadOnlyList<string> ClientIds);

    /// <summary>Facebook Login (OIDC code flow). RedirectUri must match the app's fb{AppId}://authorize exactly.</summary>
    public sealed record FacebookAuthOptions(string AppId, string AppSecret, string RedirectUri, string GraphVersion);

    /// <summary>Reddit "web app" (confidential client). RedirectUri must match the one registered on Reddit exactly.</summary>
    public sealed record RedditAuthOptions(string ClientId, string ClientSecret, string RedirectUri, string UserAgent);

    /// <summary>
    /// Every sign-in setting, read once at startup. All of them are required: a missing or empty value stops the API
    /// with the list of what is missing, so a misconfigured provider can never fall back to a default.
    /// </summary>
    public sealed record AuthOptions(byte[] JwtKey, GoogleAuthOptions Google, FacebookAuthOptions Facebook, RedditAuthOptions Reddit)
    {
        public const int MinJwtKeyBytes = 32;

        public static AuthOptions FromEnvironment(Func<string, string?> read)
        {
            var missing = new List<string>();
            string Get(string name)
            {
                var value = read(name)?.Trim();
                if (string.IsNullOrEmpty(value)) missing.Add(name);
                return value ?? "";
            }

            var secret = Get("JWT_SECRET");
            var googleIds = (read("GOOGLE_CLIENT_IDS") ?? "")
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (googleIds.Length == 0) missing.Add("GOOGLE_CLIENT_IDS");
            var facebook = new FacebookAuthOptions(Get("FACEBOOK_APP_ID"), Get("FACEBOOK_APP_SECRET"), Get("FACEBOOK_REDIRECT_URI"), Get("FACEBOOK_GRAPH_VERSION"));
            var reddit = new RedditAuthOptions(Get("REDDIT_CLIENT_ID"), Get("REDDIT_CLIENT_SECRET"), Get("REDDIT_REDIRECT_URI"), Get("REDDIT_USER_AGENT"));

            if (missing.Count > 0)
                throw new InvalidOperationException($"Missing auth settings: {string.Join(", ", missing)}. Set them in src/.env (development) or the production environment.");

            var key = Encoding.UTF8.GetBytes(secret);
            if (key.Length < MinJwtKeyBytes)
                throw new InvalidOperationException($"JWT_SECRET must be at least {MinJwtKeyBytes} bytes.");

            return new AuthOptions(key, new GoogleAuthOptions(googleIds), facebook, reddit);
        }
    }
}
