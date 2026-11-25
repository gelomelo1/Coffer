using Coffer.BusinessLogic.Auth;

namespace Coffer.Tests.Auth
{
    /// <summary>Every sign-in setting is required; the API refuses to start without them.</summary>
    public class AuthOptionsTests
    {
        private static Dictionary<string, string?> Complete() => new()
        {
            ["JWT_SECRET"] = "0123456789abcdef0123456789abcdef",
            ["GOOGLE_CLIENT_ID"] = "web.apps.googleusercontent.com",
            ["GOOGLE_CLIENT_SECRET"] = "google-secret",
            ["GOOGLE_REDIRECT_URI"] = "https://api.coffer.example/api/auth/google/callback",
            ["GOOGLE_APP_REDIRECT_URI"] = "com.gelomelo.coffer://oauth/google",
            ["FACEBOOK_APP_ID"] = "123",
            ["FACEBOOK_APP_SECRET"] = "fb-secret",
            ["FACEBOOK_REDIRECT_URI"] = "fb123://authorize",
            ["FACEBOOK_GRAPH_VERSION"] = "v21.0",
            ["DISCORD_CLIENT_ID"] = "discord-id",
            ["DISCORD_CLIENT_SECRET"] = "discord-secret",
            ["DISCORD_REDIRECT_URI"] = "discord-discord-id:/authorize/callback",
            ["GITHUB_CLIENT_ID"] = "github-id",
            ["GITHUB_CLIENT_SECRET"] = "github-secret",
            ["GITHUB_REDIRECT_URI"] = "com.gelomelo.coffer://oauth/github",
        };

        private static AuthOptions Load(Dictionary<string, string?> values) =>
            AuthOptions.FromEnvironment(name => values.TryGetValue(name, out var v) ? v : null);

        [Fact]
        public void All_values_present_loads()
        {
            var o = Load(Complete());

            Assert.Equal("0123456789abcdef0123456789abcdef"u8.ToArray(), o.JwtKey);
            Assert.Equal(new GoogleAuthOptions("web.apps.googleusercontent.com", "google-secret",
                "https://api.coffer.example/api/auth/google/callback", "com.gelomelo.coffer://oauth/google"), o.Google);
            Assert.Equal(new FacebookAuthOptions("123", "fb-secret", "fb123://authorize", "v21.0"), o.Facebook);
            Assert.Equal(new DiscordAuthOptions("discord-id", "discord-secret", "discord-discord-id:/authorize/callback"), o.Discord);
            Assert.Equal(new GithubAuthOptions("github-id", "github-secret", "com.gelomelo.coffer://oauth/github"), o.Github);
        }

        [Fact]
        public void Missing_values_are_all_listed()
        {
            var values = Complete();
            values.Remove("FACEBOOK_APP_ID");
            values["GITHUB_CLIENT_SECRET"] = "   ";

            var e = Assert.Throws<InvalidOperationException>(() => Load(values));

            Assert.Contains("FACEBOOK_APP_ID", e.Message);
            Assert.Contains("GITHUB_CLIENT_SECRET", e.Message);
            Assert.DoesNotContain("GOOGLE_CLIENT_ID", e.Message);
        }

        [Fact]
        public void Short_jwt_secret_is_rejected()
        {
            var values = Complete();
            values["JWT_SECRET"] = new string('x', 31);

            var e = Assert.Throws<InvalidOperationException>(() => Load(values));

            Assert.Contains("JWT_SECRET must be at least 32 bytes", e.Message);
        }

        [Theory]
        [InlineData("change-me-to-a-long-random-secret-at-least-32-characters")]
        [InlineData("CHANGE-ME and some more characters to pass the length")]
        public void Placeholder_jwt_secret_is_rejected(string placeholder)
        {
            var values = Complete();
            values["JWT_SECRET"] = placeholder;

            var e = Assert.Throws<InvalidOperationException>(() => Load(values));

            Assert.Contains("JWT_SECRET is still the placeholder", e.Message);
        }

        [Theory]
        [InlineData("https://api.coffer.example/api/auth/google/callback", true)]
        [InlineData("http://localhost:5141/api/auth/google/callback", true)]
        [InlineData("http://127.0.0.1:5141/api/auth/google/callback", true)]
        [InlineData("http://10.0.2.2:5141/api/auth/google/callback", false)]
        [InlineData("https://api.coffer.example/somewhere-else", false)]
        public void Google_callback_must_be_the_api_callback_over_https_or_localhost(string callback, bool accepted)
        {
            var values = Complete();
            values["GOOGLE_REDIRECT_URI"] = callback;

            var error = Record.Exception(() => Load(values));

            if (accepted) Assert.Null(error);
            else Assert.Contains("GOOGLE_REDIRECT_URI", Assert.IsType<InvalidOperationException>(error).Message);
        }

        [Fact]
        public void Facebook_redirect_must_match_the_app_id()
        {
            var values = Complete();
            values["FACEBOOK_REDIRECT_URI"] = "fb999://authorize";

            var e = Assert.Throws<InvalidOperationException>(() => Load(values));

            Assert.Contains("FACEBOOK_REDIRECT_URI must be fb123://authorize", e.Message);
        }

        [Fact]
        public void Discord_redirect_must_match_the_client_id()
        {
            var values = Complete();
            values["DISCORD_REDIRECT_URI"] = "discord-someone-else:/authorize/callback";

            var e = Assert.Throws<InvalidOperationException>(() => Load(values));

            Assert.Contains("DISCORD_REDIRECT_URI must be discord-discord-id:/authorize/callback", e.Message);
        }

        private static AuthOptions LoadDev(Dictionary<string, string?> values) =>
            AuthOptions.FromEnvironment(name => values.TryGetValue(name, out var v) ? v : null, strict: false);

        [Fact]
        public void Development_starts_without_oauth_values_and_warns()
        {
            var values = new Dictionary<string, string?> { ["JWT_SECRET"] = "0123456789abcdef0123456789abcdef" };

            var o = LoadDev(values);

            Assert.Null(o.Google);
            Assert.Null(o.Facebook);
            Assert.Null(o.Discord);
            Assert.Null(o.Github);
            Assert.Contains(o.Warnings, w => w.Contains("Google") && w.Contains("GOOGLE_CLIENT_ID"));
            Assert.Contains(o.Warnings, w => w.Contains("Facebook") && w.Contains("FACEBOOK_APP_ID"));
            Assert.Contains(o.Warnings, w => w.Contains("Discord") && w.Contains("DISCORD_CLIENT_SECRET"));
            Assert.Contains(o.Warnings, w => w.Contains("GitHub") && w.Contains("GITHUB_CLIENT_ID"));
        }

        [Fact]
        public void Development_switches_off_only_the_broken_provider()
        {
            var values = Complete();
            values["DISCORD_REDIRECT_URI"] = "discord-someone-else:/authorize/callback";
            values["FACEBOOK_APP_SECRET"] = "change-me";

            var o = LoadDev(values);

            Assert.Null(o.Discord);
            Assert.Null(o.Facebook);
            Assert.NotNull(o.Google);
            Assert.NotNull(o.Github);
            Assert.Contains(o.Warnings, w => w.Contains("DISCORD_REDIRECT_URI must be discord-discord-id:/authorize/callback"));
            Assert.Contains(o.Warnings, w => w.Contains("FACEBOOK_APP_SECRET"));
        }

        [Fact]
        public void Development_still_needs_the_jwt_secret()
        {
            var values = Complete();
            values.Remove("JWT_SECRET");

            var e = Assert.Throws<InvalidOperationException>(() => LoadDev(values));

            Assert.Contains("JWT_SECRET", e.Message);
        }

        [Fact]
        public void Complete_values_give_no_warnings()
        {
            Assert.Empty(LoadDev(Complete()).Warnings);
            Assert.Empty(Load(Complete()).Warnings);
        }

        [Theory]
        [InlineData("change-me")]
        [InlineData("your-discord-client-id")]
        public void Production_refuses_placeholders(string placeholder)
        {
            var values = Complete();
            values["DISCORD_CLIENT_SECRET"] = placeholder;

            var e = Assert.Throws<InvalidOperationException>(() => Load(values));

            Assert.Contains("DISCORD_CLIENT_SECRET", e.Message);
        }

        [Theory]
        [InlineData("com.gelomelo.coffer://oauth/google", true)]
        [InlineData("https://evil.example/oauth/google", false)]
        [InlineData("http://localhost/oauth/google", false)]
        [InlineData("com.gelomelo.coffer://oauth/google?x=1", false)]
        [InlineData("com.gelomelo.coffer://oauth/google#x", false)]
        [InlineData("not a uri", false)]
        public void Google_app_redirect_must_be_an_app_scheme_without_query(string appRedirect, bool accepted)
        {
            var values = Complete();
            values["GOOGLE_APP_REDIRECT_URI"] = appRedirect;

            var error = Record.Exception(() => Load(values));

            if (accepted) Assert.Null(error);
            else Assert.Contains("GOOGLE_APP_REDIRECT_URI", Assert.IsType<InvalidOperationException>(error).Message);
        }
}
}
