using System.Net;
using System.Net.Http.Json;
using System.Text;
using Coffer.BusinessLogic.Auth.OAuth;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Coffer.Tests.Auth
{
    /// <summary>GitHub: authorization code + PKCE S256 + state, confidential client, identity = numeric GitHub id.</summary>
    public class GithubSignInTests : BrowserSignInTestBase
    {
        private const string TokenEndpoint = "https://github.com/login/oauth/access_token";
        private const string User = "https://api.github.com/user";
        private const string Emails = "https://api.github.com/user/emails";
        private const string Revoke = "https://api.github.com/applications/test-github-id/token";
        private const string Redirect = "com.gelomelo.coffer://oauth/github";

        protected override string Provider => "github";

        private (HttpStatusCode, string) _token = (HttpStatusCode.OK, "{\"access_token\":\"gho_access\",\"token_type\":\"bearer\",\"scope\":\"read:user,user:email\"}");
        private (HttpStatusCode, string) _user = (HttpStatusCode.OK, "{\"id\":12345,\"login\":\"anna-gh\",\"avatar_url\":\"https://avatars.githubusercontent.com/u/12345?v=4\"}");
        private (HttpStatusCode, string) _emails = (HttpStatusCode.OK,
            "[{\"email\":\"old@example.com\",\"primary\":false,\"verified\":true},{\"email\":\"anna@github.example\",\"primary\":true,\"verified\":true}]");

        public GithubSignInTests()
        {
            Http.Responder = (request, _) =>
            {
                var url = request.RequestUri!.ToString();
                if (url == TokenEndpoint) return _token;
                if (url == Emails) return _emails;
                if (url == User) return _user;
                if (url == Revoke) return (HttpStatusCode.NoContent, "");
                return (HttpStatusCode.NotFound, "{}");
            };
            Init(s => s.AddHttpClient<IGithubOAuthClient, GithubOAuthClient>().ConfigurePrimaryHttpMessageHandler(() => Http));
        }

        [Fact]
        public async Task Start_builds_url_from_server_config()
        {
            var s = await Start();

            Assert.Equal("https://github.com/login/oauth/authorize", s.Url.GetLeftPart(UriPartial.Path));
            Assert.Equal("test-github-id", s.Query["client_id"]);
            Assert.Equal(Redirect, s.Query["redirect_uri"]);
            Assert.Equal(Redirect, s.RedirectUri);
            // Only what Coffer uses: the public profile (id, login, avatar) needs no scope; user:email adds the e-mails.
            Assert.Equal("user:email", s.Query["scope"]);
            Assert.Equal("S256", s.Query["code_challenge_method"]);
            Assert.Equal(43, s.State.Length);
            Assert.DoesNotContain(s.Id, s.Url.ToString());
        }

        [Fact]
        public async Task Token_request_carries_secret_verifier_and_redirect()
        {
            var s = await Start();
            await Complete(s);

            var form = FakeHttp.Form(Assert.Single(Http.Calls, c => c.Url.ToString() == TokenEndpoint).Body);
            Assert.Equal("test-github-id", form["client_id"]);
            Assert.Equal("test-github-secret", form["client_secret"]);
            Assert.Equal("the-code", form["code"]);
            Assert.Equal(Redirect, form["redirect_uri"]);
            Assert.Equal(s.Query["code_challenge"], S256(form["code_verifier"]));
            Assert.Equal("Bearer gho_access", Assert.Single(Http.Calls, c => c.Url.ToString() == User).Authorization);
            Assert.Contains("Coffer", Assert.Single(Http.Calls, c => c.Url.ToString() == User).UserAgent);
        }

        [Fact]
        public async Task New_user_registers_with_numeric_id_and_primary_verified_email()
        {
            var body = await SignInApi.Json(await StartAndComplete());
            var register = await Client.PostAsJsonAsync("api/auth/register", new { registrationId = body.Str("registrationId"), username = "annagh", country = "HU" });

            Assert.Equal(HttpStatusCode.OK, register.StatusCode);
            var user = await Api.Db.NewContext().Users.SingleAsync(u => u.Name == "annagh");
            Assert.Equal(("github", "12345", "anna@github.example"), (user.Provider, user.ProviderUserId, user.Email));
            Assert.Equal("https://avatars.githubusercontent.com/u/12345", user.Avatar);
        }

        [Fact]
        public async Task Existing_github_user_signs_in_again()
        {
            var user = Api.Db.AddUser("gelomelo");
            user.Provider = "github";
            user.ProviderUserId = "12345";
            Api.Db.Context.SaveChanges();

            var body = await SignInApi.Json(await StartAndComplete());

            Assert.Equal("signedIn", body.Str("status"));
            Assert.Equal(HttpStatusCode.OK, await SignInApi.CurrentUserStatus(Api, body.Str("accessToken")!));
        }

        [Fact]
        public async Task Unverified_primary_email_is_not_kept()
        {
            _emails = (HttpStatusCode.OK, "[{\"email\":\"anna@github.example\",\"primary\":true,\"verified\":false}]");

            var body = await SignInApi.Json(await StartAndComplete());
            await Client.PostAsJsonAsync("api/auth/register", new { registrationId = body.Str("registrationId"), username = "unverified", country = "HU" });

            Assert.Equal("", (await Api.Db.NewContext().Users.SingleAsync(u => u.Name == "unverified")).Email);
        }

        [Fact]
        public async Task Only_that_token_is_revoked_after_use()
        {
            await StartAndComplete();

            var call = Assert.Single(Http.Calls, c => c.Url.ToString() == Revoke);
            Assert.Equal(HttpMethod.Delete, call.Method);
            Assert.Equal("Basic " + Convert.ToBase64String(Encoding.UTF8.GetBytes("test-github-id:test-github-secret")), call.Authorization);
            Assert.Contains("gho_access", call.Body);
        }

        [Fact]
        public async Task State_mismatch_fails()
        {
            await AssertFailed(await Complete(await Start(), state: "forged"));
            Assert.Equal(0, Http.CallsTo(TokenEndpoint));
        }

        [Fact]
        public async Task Replayed_transaction_fails()
        {
            var s = await Start();
            Assert.Equal(HttpStatusCode.OK, (await Complete(s)).StatusCode);

            Assert.Equal(HttpStatusCode.BadRequest, (await Complete(s)).StatusCode);
            Assert.Equal(1, Http.CallsTo(TokenEndpoint));
        }

        [Fact]
        public async Task Facebook_transaction_is_not_accepted_for_github()
        {
            OAuthTransaction facebook;
            using (var scope = Api.Services.CreateScope())
                facebook = scope.ServiceProvider.GetRequiredService<OAuthTransactionStore>().Create(Providers.Facebook, withNonce: true, withPkce: true);

            await AssertFailed(await Complete(await Start(), state: facebook.State, transactionId: facebook.Id));
        }

        [Fact]
        public async Task Github_error_in_200_body_fails_cleanly()
        {
            _token = (HttpStatusCode.OK, "{\"error\":\"bad_verification_code\",\"error_description\":\"The code passed is incorrect or expired.\"}");

            await AssertFailed(await StartAndComplete());
        }

        [Fact]
        public async Task Missing_id_fails()
        {
            _user = (HttpStatusCode.OK, "{\"login\":\"anna-gh\"}");

            await AssertFailed(await StartAndComplete());
        }

        [Fact]
        public async Task Malformed_json_fails_cleanly()
        {
            _emails = (HttpStatusCode.OK, "{not json");

            await AssertFailed(await StartAndComplete());
        }

        [Fact]
        public async Task Outage_fails_cleanly()
        {
            Http.Responder = (_, _) => throw new HttpRequestException("connection refused");

            await AssertFailed(await StartAndComplete());
        }
    
        [Fact]
        public async Task Token_is_revoked_even_when_reading_the_account_fails()
        {
            _user = (HttpStatusCode.InternalServerError, "oops");

            await AssertFailed(await StartAndComplete());

            Assert.Single(Http.Calls, c => c.Url.ToString() == Revoke);
        }

        [Fact]
        public async Task A_failing_revoke_does_not_fail_the_sign_in()
        {
            var inner = Http.Responder;
            Http.Responder = (request, body) => request.RequestUri!.ToString() == Revoke
                ? throw new HttpRequestException("revoke endpoint down")
                : inner(request, body);

            var result = await SignInApi.Json(await StartAndComplete());

            Assert.Equal("registrationRequired", result.Str("status"));
        }

        [Fact]
        public async Task A_slow_revoke_does_not_hold_up_the_sign_in()
        {
            Http.Delay = request => request.RequestUri!.ToString() == Revoke ? TimeSpan.FromSeconds(30) : null;
            var watch = System.Diagnostics.Stopwatch.StartNew();

            var response = await StartAndComplete();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.True(watch.Elapsed < TimeSpan.FromSeconds(10), $"took {watch.Elapsed}");
        }

        [Theory]
        [InlineData("{\"id\":\"12345\",\"login\":\"anna-gh\"}")]
        [InlineData("{\"id\":0,\"login\":\"anna-gh\"}")]
        [InlineData("{\"id\":-5,\"login\":\"anna-gh\"}")]
        public async Task Invalid_id_fails(string user)
        {
            _user = (HttpStatusCode.OK, user);

            await AssertFailed(await StartAndComplete());
        }

        [Fact]
        public async Task Non_https_avatar_is_dropped()
        {
            _user = (HttpStatusCode.OK, "{\"id\":777,\"login\":\"x\",\"avatar_url\":\"http://evil.example/a.png\"}");

            var result = await SignInApi.Json(await StartAndComplete());
            await Client.PostAsJsonAsync("api/auth/register", new { registrationId = result.Str("registrationId"), username = "plainavatar", country = "HU" });

            Assert.Null((await Api.Db.NewContext().Users.SingleAsync(u => u.Name == "plainavatar")).Avatar);
        }

        [Fact]
        public async Task Emails_endpoint_failure_fails_cleanly()
        {
            _emails = (HttpStatusCode.Forbidden, "{\"message\":\"Resource not accessible\"}");

            await AssertFailed(await StartAndComplete());
        }

        [Fact]
        public async Task Only_a_verified_non_primary_address_means_no_email()
        {
            _emails = (HttpStatusCode.OK, "[{\"email\":\"other@example.com\",\"primary\":false,\"verified\":true},{\"email\":\"main@example.com\",\"primary\":true,\"verified\":false}]");

            var result = await SignInApi.Json(await StartAndComplete());
            await Client.PostAsJsonAsync("api/auth/register", new { registrationId = result.Str("registrationId"), username = "noprimary", country = "HU" });

            Assert.Equal("", (await Api.Db.NewContext().Users.SingleAsync(u => u.Name == "noprimary")).Email);
        }

        [Fact]
        public async Task An_account_stored_under_the_github_login_is_not_matched()
        {
            var user = Api.Db.AddUser("someone");
            user.Provider = "github";
            user.ProviderUserId = "anna-gh"; // the GitHub login of the signing-in account, not its id
            Api.Db.Context.SaveChanges();

            var result = await SignInApi.Json(await StartAndComplete());

            Assert.Equal("registrationRequired", result.Str("status"));
        }

        [Fact]
        public async Task Logs_never_contain_code_tokens_or_secret()
        {
            _user = (HttpStatusCode.InternalServerError, "oops");

            await Complete(await Start(), code: "SECRET-GITHUB-CODE");

            AssertLogHasNo("SECRET-GITHUB-CODE", "gho_access", "test-github-secret");
        }
}
}
