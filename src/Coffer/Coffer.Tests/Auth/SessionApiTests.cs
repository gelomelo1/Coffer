using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Coffer.BusinessLogic.Account;
using Coffer.BusinessLogic.Auth.OAuth;
using Coffer.BusinessLogic.Auth.Sessions;
using Microsoft.Extensions.DependencyInjection;

namespace Coffer.Tests.Auth
{
    /// <summary>api/auth/refresh, api/auth/logout, rate limits, and what is gone (GitHub app sign-in).</summary>
    public class SessionApiTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private readonly HttpClient _client;
        private readonly FakeGoogleValidator _google = new();

        public SessionApiTests()
        {
            _api.Overrides = s => s.AddSingleton<IGoogleIdTokenValidator>(_google);
            _client = _api.CreateClient();
        }

        public void Dispose() => _api.Dispose();

        private async Task<SessionTokens> SignIn(string name = "anna")
        {
            var user = _api.Db.AddUser(name);
            using var scope = _api.Services.CreateScope();
            return await scope.ServiceProvider.GetRequiredService<ISessionService>().IssueAsync(user.Id);
        }

        private Task<HttpResponseMessage> Refresh(string token) => _client.PostAsJsonAsync("api/auth/refresh", new { refreshToken = token });

        [Fact]
        public async Task Refresh_endpoint_rotates()
        {
            var tokens = await SignIn();

            var response = await Refresh(tokens.RefreshToken);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await SignInApi.Json(response);
            Assert.NotEqual(tokens.RefreshToken, body.Str("refreshToken"));
            Assert.Equal(HttpStatusCode.OK, await SignInApi.CurrentUserStatus(_api, body.Str("accessToken")!));
            var again = await Refresh(tokens.RefreshToken);
            Assert.Equal(HttpStatusCode.Unauthorized, again.StatusCode);
            Assert.Equal("invalidRefreshToken", (await SignInApi.Json(again)).Str("code"));
        }

        [Fact]
        public async Task Logout_revokes_session_and_access_token_stops_working()
        {
            var tokens = await SignIn();
            var client = _api.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokens.AccessToken);

            var response = await client.PostAsJsonAsync("api/auth/logout", new { refreshToken = tokens.RefreshToken });

            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, await SignInApi.CurrentUserStatus(_api, tokens.AccessToken));
            Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(tokens.RefreshToken)).StatusCode);
        }

        [Fact]
        public async Task Logout_with_access_token_only_revokes_that_session()
        {
            var tokens = await SignIn();
            var client = _api.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokens.AccessToken);

            Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsJsonAsync("api/auth/logout", new { })).StatusCode);

            Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(tokens.RefreshToken)).StatusCode);
        }

        [Fact]
        public async Task Suspended_user_can_still_log_out()
        {
            var tokens = await SignIn();
            var userId = _api.Db.NewContext().AuthSessions.Single().UserId;
            var admin = _api.Db.AddManagerAdmin();
            using (var scope = _api.Services.CreateScope())
                await scope.ServiceProvider.GetRequiredService<Coffer.BusinessLogic.Moderation.ISuspensionService>()
                    .SuspendAsync(admin.Id, new Coffer.BusinessLogic.Moderation.CreateSuspensionInput(userId, 24, "Repeated harassment in comments."));
            var client = _api.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokens.AccessToken);

            var response = await client.PostAsJsonAsync("api/auth/logout", new { refreshToken = tokens.RefreshToken });

            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
            Assert.NotNull(_api.Db.NewContext().AuthSessions.Single().RevokedAt);
        }

        [Fact]
        public async Task Auth_responses_are_not_cached()
        {
            var tokens = await SignIn();

            var response = await Refresh(tokens.RefreshToken);

            Assert.Contains("no-store", response.Headers.CacheControl?.ToString() ?? "");
        }

        [Fact]
        public async Task Logout_with_unknown_token_is_204()
        {
            var response = await _client.PostAsJsonAsync("api/auth/logout", new { refreshToken = "nope" });

            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        }

        [Fact]
        public async Task Account_deletion_revokes_sessions()
        {
            var tokens = await SignIn();
            var userId = _api.Db.NewContext().AuthSessions.Single().UserId;

            using (var scope = _api.Services.CreateScope())
                await scope.ServiceProvider.GetRequiredService<IAccountDeletionService>().DeleteAccountAsync(userId);

            Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(tokens.RefreshToken)).StatusCode);
            var session = _api.Db.NewContext().AuthSessions.Single();
            Assert.Equal(SessionService.ReasonAccountDeleted, session.RevokeReason);
        }

        [Theory]
        [InlineData("api/auth/github/validate")]
        [InlineData("api/auth/github/register")]
        [InlineData("api/auth/google/register")]
        public async Task Removed_endpoints_are_gone(string path)
        {
            var response = await _client.PostAsJsonAsync(path, new { code = "x", codeVerifier = "y", tempId = "z", username = "u", country = "HU" });

            // No such action: the SPA fallback answers 405 for POST, plain routing 404.
            Assert.Contains(response.StatusCode, new[] { HttpStatusCode.NotFound, HttpStatusCode.MethodNotAllowed });
        }

        [Fact]
        public async Task Auth_endpoints_are_rate_limited()
        {
            HttpResponseMessage last = null!;
            for (var i = 0; i < 21; i++)
                last = await _client.PostAsJsonAsync("api/auth/google/validate", new { idToken = "forged" });

            Assert.Equal(HttpStatusCode.TooManyRequests, last.StatusCode);
            Assert.Equal("tooManyAuthRequests", (await SignInApi.Json(last)).Str("code"));
        }

        [Fact]
        public async Task Refresh_has_its_own_larger_limit()
        {
            for (var i = 0; i < 20; i++)
                await _client.PostAsJsonAsync("api/auth/google/validate", new { idToken = "forged" });

            // The sign-in window is used up, refreshing still works.
            var tokens = await SignIn();
            Assert.Equal(HttpStatusCode.OK, (await Refresh(tokens.RefreshToken)).StatusCode);
        }
    }
}
