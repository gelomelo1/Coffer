using Coffer.BusinessLogic.Auth;

namespace Coffer.Tests.Auth
{
    /// <summary>Every sign-in setting is required; the API refuses to start without them.</summary>
    public class AuthOptionsTests
    {
        private static Dictionary<string, string?> Complete() => new()
        {
            ["JWT_SECRET"] = "0123456789abcdef0123456789abcdef",
            ["GOOGLE_CLIENT_IDS"] = "web.apps.googleusercontent.com",
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
            Assert.Equal(new[] { "web.apps.googleusercontent.com" }, o.Google.ClientIds);
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
            Assert.DoesNotContain("GOOGLE_CLIENT_IDS", e.Message);
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

        [Fact]
        public void Google_ids_are_split_and_trimmed()
        {
            var values = Complete();
            values["GOOGLE_CLIENT_IDS"] = "a, b ,";

            Assert.Equal(new[] { "a", "b" }, Load(values).Google.ClientIds);
        }

        [Fact]
        public void Only_commas_counts_as_missing()
        {
            var values = Complete();
            values["GOOGLE_CLIENT_IDS"] = " , ";

            var e = Assert.Throws<InvalidOperationException>(() => Load(values));

            Assert.Contains("GOOGLE_CLIENT_IDS", e.Message);
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
}
}
