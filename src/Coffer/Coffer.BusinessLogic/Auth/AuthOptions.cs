using System.Text;

namespace Coffer.BusinessLogic.Auth
{
    /// <summary>
    /// Google "Web application" client. Google redirects to the API's callback (RedirectUri); the API then sends the
    /// browser back to the app at AppRedirectUri (config only, never taken from a request).
    /// </summary>
    public sealed record GoogleAuthOptions(string ClientId, string ClientSecret, string RedirectUri, string AppRedirectUri);

    /// <summary>Facebook Login (OIDC code flow). RedirectUri must match the app's fb{AppId}://authorize exactly.</summary>
    public sealed record FacebookAuthOptions(string AppId, string AppSecret, string RedirectUri, string GraphVersion);

    /// <summary>Discord application (confidential client). RedirectUri must match the one registered on Discord exactly.</summary>
    public sealed record DiscordAuthOptions(string ClientId, string ClientSecret, string RedirectUri);

    /// <summary>GitHub OAuth app (confidential client). RedirectUri must match the app's callback URL exactly.</summary>
    public sealed record GithubAuthOptions(string ClientId, string ClientSecret, string RedirectUri);

    /// <summary>
    /// Every sign-in setting, read once at startup. JWT_SECRET is always required. The provider settings are required
    /// outside development (strict): anything missing, still a placeholder (change-me / your-…) or inconsistent stops
    /// the API with the full list. In development a provider with a problem is switched off instead (null here), the
    /// problem is a startup warning, and that provider's sign-in answers providerNotConfigured.
    /// </summary>
    public sealed record AuthOptions(
        byte[] JwtKey,
        GoogleAuthOptions? Google,
        FacebookAuthOptions? Facebook,
        DiscordAuthOptions? Discord,
        GithubAuthOptions? Github,
        IReadOnlyList<string> Warnings)
    {
        public const int MinJwtKeyBytes = 32;

        public static AuthOptions FromEnvironment(Func<string, string?> read, bool strict = true)
        {
            var key = ReadJwtKey(read);
            var problems = new List<string>();

            T? Provider<T>(string name, Func<List<string>, T> build) where T : class
            {
                var own = new List<string>();
                var options = build(own);
                if (own.Count == 0) return options;
                problems.Add($"{name} sign-in is off: {string.Join("; ", own)}");
                return null;
            }

            var google = Provider("Google", own =>
            {
                var o = new GoogleAuthOptions(Get(read, own, "GOOGLE_CLIENT_ID"), Get(read, own, "GOOGLE_CLIENT_SECRET"),
                    Get(read, own, "GOOGLE_REDIRECT_URI"), Get(read, own, "GOOGLE_APP_REDIRECT_URI"));
                if (own.Count == 0 && !IsApiCallback(o.RedirectUri))
                    own.Add($"GOOGLE_REDIRECT_URI must be the API's /api/auth/google/callback over https (http only on localhost), not {o.RedirectUri}");
                if (own.Count == 0 && !IsAppRedirect(o.AppRedirectUri))
                    own.Add($"GOOGLE_APP_REDIRECT_URI must be the app's own scheme (e.g. com.gelomelo.coffer://oauth/google) without ? or #, not {o.AppRedirectUri}");
                return o;
            });
            var facebook = Provider("Facebook", own =>
            {
                var o = new FacebookAuthOptions(Get(read, own, "FACEBOOK_APP_ID"), Get(read, own, "FACEBOOK_APP_SECRET"),
                    Get(read, own, "FACEBOOK_REDIRECT_URI"), Get(read, own, "FACEBOOK_GRAPH_VERSION"));
                if (own.Count == 0) RequireRedirect(own, "FACEBOOK_REDIRECT_URI", o.RedirectUri, $"fb{o.AppId}://authorize");
                return o;
            });
            var discord = Provider("Discord", own =>
            {
                var o = new DiscordAuthOptions(Get(read, own, "DISCORD_CLIENT_ID"), Get(read, own, "DISCORD_CLIENT_SECRET"), Get(read, own, "DISCORD_REDIRECT_URI"));
                if (own.Count == 0) RequireRedirect(own, "DISCORD_REDIRECT_URI", o.RedirectUri, $"discord-{o.ClientId}:/authorize/callback");
                return o;
            });
            var github = Provider("GitHub", own =>
                new GithubAuthOptions(Get(read, own, "GITHUB_CLIENT_ID"), Get(read, own, "GITHUB_CLIENT_SECRET"), Get(read, own, "GITHUB_REDIRECT_URI")));

            if (strict && problems.Count > 0)
                throw new InvalidOperationException(
                    $"Sign-in settings are incomplete. {string.Join(" ", problems.Select(p => p + "."))} Set them in the production environment.");

            return new AuthOptions(key, google, facebook, discord, github, problems);
        }

        /// <summary>The value, or "" with a problem when it is missing or still a placeholder.</summary>
        private static string Get(Func<string, string?> read, List<string> problems, string name)
        {
            var value = read(name)?.Trim() ?? "";
            if (value.Length == 0) problems.Add($"{name} is missing");
            else if (IsPlaceholder(value)) problems.Add($"{name} is still a placeholder");
            return value;
        }

        /// <summary>The placeholders of the .env.example files (change-me…, your-…), also inside a derived redirect.</summary>
        private static bool IsPlaceholder(string value) =>
            value.Contains("change-me", StringComparison.OrdinalIgnoreCase) || value.StartsWith("your-", StringComparison.OrdinalIgnoreCase);

        /// <summary>Google allows plain http only for localhost (development, with adb reverse on the emulator).</summary>
        private static bool IsApiCallback(string uri) =>
            Uri.TryCreate(uri, UriKind.Absolute, out var u)
            && u.AbsolutePath.Equals("/api/auth/google/callback", StringComparison.Ordinal)
            && string.IsNullOrEmpty(u.Query) && string.IsNullOrEmpty(u.Fragment)
            && (u.Scheme == Uri.UriSchemeHttps || (u.Scheme == Uri.UriSchemeHttp && (u.Host == "localhost" || u.Host == "127.0.0.1")));

        /// <summary>The state and the one-time handle go there: an app scheme only, never a web address.</summary>
        private static bool IsAppRedirect(string uri) =>
            Uri.TryCreate(uri, UriKind.Absolute, out var u)
            && u.Scheme != Uri.UriSchemeHttp && u.Scheme != Uri.UriSchemeHttps
            && !uri.Contains('?') && !uri.Contains('#');

        /// <summary>Each redirect is derived from its app id (the mobile app registers that scheme).</summary>
        private static void RequireRedirect(List<string> problems, string name, string actual, string expected)
        {
            if (!string.Equals(actual, expected, StringComparison.Ordinal))
                problems.Add($"{name} must be {expected} (derived from its app id), not {actual}");
        }

        /// <summary>Signs every session: required everywhere, at least 32 bytes, never the public placeholder.</summary>
        private static byte[] ReadJwtKey(Func<string, string?> read)
        {
            var secret = read("JWT_SECRET")?.Trim();
            if (string.IsNullOrEmpty(secret))
                throw new InvalidOperationException("Missing auth settings: JWT_SECRET. Set it in src/.env (development) or the production environment.");
            // The value from .env.example is public: anyone could sign tokens with it.
            if (secret.StartsWith("change-me", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("JWT_SECRET is still the placeholder from .env.example. Set a long random secret.");
            var key = Encoding.UTF8.GetBytes(secret);
            if (key.Length < MinJwtKeyBytes)
                throw new InvalidOperationException($"JWT_SECRET must be at least {MinJwtKeyBytes} bytes.");
            return key;
        }
    }
}
