using System.Net;
using System.Net.Http.Json;
using Coffer.BusinessLogic.Auth;
using Microsoft.Extensions.DependencyInjection;

namespace Coffer.Tests.Auth
{
    /// <summary>In development a provider without settings is switched off: its sign-in says so instead of failing oddly.</summary>
    public class ProviderNotConfiguredTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private readonly HttpClient _client;

        public ProviderNotConfiguredTests()
        {
            // Only the JWT secret: every provider is off (as a fresh development checkout would be).
            var options = AuthOptions.FromEnvironment(
                name => name == "JWT_SECRET" ? Environment.GetEnvironmentVariable("JWT_SECRET") : null, strict: false);
            _api.Overrides = s => s.AddSingleton(options);
            _client = _api.CreateClient();
        }

        public void Dispose() => _api.Dispose();

        [Theory]
        [InlineData("api/auth/facebook/start")]
        [InlineData("api/auth/discord/start")]
        [InlineData("api/auth/github/start")]
        public async Task Browser_provider_start_says_not_configured(string path)
        {
            var response = await _client.PostAsync(path, null);

            Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
            Assert.Equal("providerNotConfigured", (await SignInApi.Json(response)).Str("code"));
        }

        [Theory]
        [InlineData("api/auth/google/complete")]
        [InlineData("api/auth/facebook/complete")]
        [InlineData("api/auth/discord/complete")]
        [InlineData("api/auth/github/complete")]
        public async Task Browser_provider_complete_says_not_configured(string path)
        {
            var response = await _client.PostAsJsonAsync(path, new { transactionId = "x", code = "y", state = "z" });

            Assert.Equal("providerNotConfigured", (await SignInApi.Json(response)).Str("code"));
        }

        [Fact]
        public async Task Google_says_not_configured()
        {
            var response = await _client.PostAsync("api/auth/google/start", null);

            Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
            Assert.Equal("providerNotConfigured", (await SignInApi.Json(response)).Str("code"));
        }

        [Fact]
        public async Task Sessions_and_dev_login_keep_working()
        {
            var user = _api.Db.AddUser("anna");

            Assert.Equal(HttpStatusCode.OK, (await _api.ClientFor(user).GetAsync("api/auth/currentUser")).StatusCode);
        }
    }
}
