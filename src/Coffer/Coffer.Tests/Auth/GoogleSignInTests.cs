using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Coffer.BusinessLogic.Auth.OAuth;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Coffer.Tests.Auth
{
    /// <summary>
    /// Google: OIDC code flow with PKCE S256, state and nonce. Google redirects to the backend (Google disables app-scheme
    /// redirects for Android clients); the backend exchanges the code, verifies the ID token, keeps only the verified
    /// identity and sends the browser back to the app with the state. The app then collects the result once.
    /// </summary>
    public class GoogleSignInTests : BrowserSignInTestBase
    {
        private const string TokenEndpoint = "https://oauth2.googleapis.com/token";
        private const string Jwks = "https://www.googleapis.com/oauth2/v3/certs";
        private const string AppRedirect = "com.gelomelo.coffer://oauth/google";

        protected override string Provider => "google";

        private readonly TestJwks _key = new("g1");
        private readonly HttpClient _browser; // follows no redirects, like checking where Google's callback sends the browser
        private string _nonce = "";
        private Func<string, string> _idToken;
        private (HttpStatusCode, string)? _tokenResponse;

        public GoogleSignInTests()
        {
            _idToken = nonce => _key.Sign(Claims(nonce));
            Http.Responder = (request, _) =>
            {
                var url = request.RequestUri!.ToString();
                if (url == Jwks) return (HttpStatusCode.OK, TestJwks.Json(_key));
                if (url == TokenEndpoint)
                    return _tokenResponse ?? (HttpStatusCode.OK, JsonSerializer.Serialize(new { access_token = "google-access-token", token_type = "Bearer", expires_in = 3599, id_token = _idToken(_nonce) }));
                return (HttpStatusCode.NotFound, "{}");
            };
            Init(s => s.AddHttpClient<IGoogleOAuthClient, GoogleOAuthClient>().ConfigurePrimaryHttpMessageHandler(() => Http));
            _browser = Api.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        }

        private static Dictionary<string, object> Claims(string nonce, string sub = "google-sub-1", bool emailVerified = true) => new()
        {
            ["iss"] = "https://accounts.google.com",
            ["aud"] = TestEnvironment.GoogleClientId,
            ["sub"] = sub,
            ["nonce"] = nonce,
            ["email"] = "anna@gmail.example",
            ["email_verified"] = emailVerified,
            ["name"] = "Anna Google",
            ["picture"] = "https://lh3.googleusercontent.com/a/anna",
        };

        /// <summary>Google sends the browser to the backend's callback.</summary>
        private async Task<HttpResponseMessage> Callback(Started s, string? state = null, string code = "google-code", string? error = null)
        {
            _nonce = s.Query["nonce"];
            var query = error != null ? $"error={error}" : $"code={Uri.EscapeDataString(code)}";
            return await _browser.GetAsync($"api/auth/google/callback?state={Uri.EscapeDataString(state ?? s.State)}&{query}");
        }

        /// <summary>The app collects the result after the browser came back.</summary>
        private Task<HttpResponseMessage> Collect(Started s, string? state = null, string? transactionId = null) =>
            Client.PostAsJsonAsync("api/auth/google/complete", new { transactionId = transactionId ?? s.Id, state = state ?? s.State });

        private async Task<HttpResponseMessage> SignIn()
        {
            var s = await Start();
            await Callback(s);
            return await Collect(s);
        }

        private int TokenCalls => Http.Calls.Count(c => c.Url.ToString() == TokenEndpoint);

        [Fact]
        public async Task Start_builds_url_from_server_config()
        {
            var s = await Start();

            Assert.Equal("https://accounts.google.com/o/oauth2/v2/auth", s.Url.GetLeftPart(UriPartial.Path));
            Assert.Equal(TestEnvironment.GoogleClientId, s.Query["client_id"]);
            Assert.Equal(TestEnvironment.GoogleCallback, s.Query["redirect_uri"]);
            Assert.Equal("code", s.Query["response_type"]);
            Assert.Equal("openid email profile", s.Query["scope"]);
            Assert.Equal("S256", s.Query["code_challenge_method"]);
            Assert.Equal(43, s.Query["nonce"].Length);
            Assert.Equal(43, s.State.Length);
            Assert.Equal(AppRedirect, s.RedirectUri);
            Assert.DoesNotContain(s.Id, s.Url.ToString());
        }

        [Fact]
        public async Task Callback_exchanges_the_code_and_sends_only_the_state_back_to_the_app()
        {
            var s = await Start();

            var response = await Callback(s, code: "google-code");

            Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
            Assert.Equal($"{AppRedirect}?state={s.State}", response.Headers.Location!.ToString());
            var form = FakeHttp.Form(Assert.Single(Http.Calls, c => c.Url.ToString() == TokenEndpoint).Body);
            Assert.Equal("authorization_code", form["grant_type"]);
            Assert.Equal("google-code", form["code"]);
            Assert.Equal(TestEnvironment.GoogleClientId, form["client_id"]);
            Assert.Equal("test-google-secret", form["client_secret"]);
            Assert.Equal(TestEnvironment.GoogleCallback, form["redirect_uri"]);
            Assert.Equal(s.Query["code_challenge"], S256(form["code_verifier"]));
        }

        [Fact]
        public async Task New_user_needs_registration_and_registers_with_google_sub()
        {
            var body = await SignInApi.Json(await SignIn());
            Assert.Equal("registrationRequired", body.Str("status"));

            var register = await Client.PostAsJsonAsync("api/auth/register", new { registrationId = body.Str("registrationId"), username = "annag", country = "HU" });

            Assert.Equal(HttpStatusCode.OK, register.StatusCode);
            var user = await Api.Db.NewContext().Users.SingleAsync(u => u.Name == "annag");
            Assert.Equal(("google", "google-sub-1", "anna@gmail.example"), (user.Provider, user.ProviderUserId, user.Email));
        }

        [Fact]
        public async Task Existing_google_user_is_signed_in_and_no_session_exists_before_collecting()
        {
            var user = Api.Db.AddUser("anna");
            user.ProviderUserId = "google-sub-1";
            Api.Db.Context.SaveChanges();
            var s = await Start();

            await Callback(s);
            Assert.Empty(Api.Db.NewContext().AuthSessions); // an abandoned sign-in leaves nothing behind
            var body = await SignInApi.Json(await Collect(s));

            Assert.Equal("signedIn", body.Str("status"));
            Assert.Equal(HttpStatusCode.OK, await SignInApi.CurrentUserStatus(Api, body.Str("accessToken")!));
        }

        [Fact]
        public async Task Unverified_email_is_not_kept()
        {
            _idToken = nonce => _key.Sign(Claims(nonce, emailVerified: false));

            var body = await SignInApi.Json(await SignIn());
            await Client.PostAsJsonAsync("api/auth/register", new { registrationId = body.Str("registrationId"), username = "unverifiedg", country = "HU" });

            Assert.Equal("", (await Api.Db.NewContext().Users.SingleAsync(u => u.Name == "unverifiedg")).Email);
        }

        [Fact]
        public async Task Wrong_nonce_fails() { _idToken = _ => _key.Sign(Claims("someone-elses-nonce")); await AssertFailed(await SignIn()); }

        [Fact]
        public async Task Wrong_audience_fails() { _idToken = n => { var c = Claims(n); c["aud"] = "other.apps.googleusercontent.com"; return _key.Sign(c); }; await AssertFailed(await SignIn()); }

        [Fact]
        public async Task Wrong_issuer_fails() { _idToken = n => { var c = Claims(n); c["iss"] = "https://www.facebook.com"; return _key.Sign(c); }; await AssertFailed(await SignIn()); }

        [Fact]
        public async Task Expired_token_fails()
        {
            _idToken = n => _key.Sign(Claims(n), expires: DateTime.UtcNow.AddMinutes(-10), issuedAt: DateTime.UtcNow.AddMinutes(-70));
            await AssertFailed(await SignIn());
        }

        [Fact]
        public async Task Hs256_token_signed_with_public_key_bytes_fails() { _idToken = n => _key.SignHs256WithPublicKey(Claims(n)); await AssertFailed(await SignIn()); }

        [Fact]
        public async Task Token_signed_with_an_unknown_key_fails() { var other = new TestJwks("other"); _idToken = n => other.Sign(Claims(n)); await AssertFailed(await SignIn()); }

        [Fact]
        public async Task Failed_exchange_still_sends_the_browser_back_with_an_error()
        {
            _tokenResponse = (HttpStatusCode.BadRequest, "{\"error\":\"invalid_grant\"}");
            var s = await Start();

            var response = await Callback(s);

            Assert.Equal($"{AppRedirect}?state={s.State}&error=failed", response.Headers.Location!.ToString());
            await AssertFailed(await Collect(s));
        }

        [Fact]
        public async Task Denied_on_google_sends_access_denied_without_any_exchange()
        {
            var s = await Start();

            var response = await Callback(s, error: "access_denied");

            Assert.Equal($"{AppRedirect}?state={s.State}&error=access_denied", response.Headers.Location!.ToString());
            Assert.Equal(0, TokenCalls);
            await AssertFailed(await Collect(s));
        }

        [Fact]
        public async Task Unknown_state_at_the_callback_does_nothing()
        {
            var s = await Start();

            var response = await Callback(s, state: "forged-state");

            Assert.Equal($"{AppRedirect}?error=failed", response.Headers.Location!.ToString());
            Assert.Equal(0, TokenCalls);
        }

        [Fact]
        public async Task Callback_replay_is_refused()
        {
            var s = await Start();
            await Callback(s);

            var replay = await Callback(s);

            Assert.EndsWith("error=failed", replay.Headers.Location!.ToString());
            Assert.Equal(1, TokenCalls);
        }

        [Fact]
        public async Task Result_can_be_collected_only_once()
        {
            var s = await Start();
            await Callback(s);
            Assert.Equal(HttpStatusCode.OK, (await Collect(s)).StatusCode);

            await AssertFailedNoSessionCheck(await Collect(s));
        }

        [Fact]
        public async Task Collecting_needs_the_matching_state()
        {
            var s = await Start();
            await Callback(s);

            await AssertFailed(await Collect(s, state: "forged"));
            await AssertFailed(await Collect(s)); // the wrong attempt used it up
        }

        [Fact]
        public async Task Collecting_before_the_callback_fails() { var s = await Start(); await AssertFailed(await Collect(s)); }

        [Fact]
        public async Task A_facebook_transaction_is_not_accepted_at_the_google_callback()
        {
            OAuthTransaction facebook;
            using (var scope = Api.Services.CreateScope())
                facebook = scope.ServiceProvider.GetRequiredService<OAuthTransactionStore>().Create(Providers.Facebook, withNonce: true, withPkce: true);

            var response = await _browser.GetAsync($"api/auth/google/callback?state={Uri.EscapeDataString(facebook.State)}&code=x");

            Assert.EndsWith("error=failed", response.Headers.Location!.ToString());
            Assert.Equal(0, TokenCalls);
        }

        [Fact]
        public async Task Outage_fails_cleanly()
        {
            Http.Responder = (_, _) => throw new HttpRequestException("connection refused");

            await AssertFailed(await SignIn());
        }

        [Fact]
        public async Task Logs_never_contain_code_tokens_or_secret()
        {
            string? idToken = null;
            _idToken = _ => idToken = _key.Sign(Claims("wrong-nonce"));
            var s = await Start();

            await Callback(s, code: "SECRET-GOOGLE-CODE");

            AssertLogHasNo("SECRET-GOOGLE-CODE", idToken!, "google-access-token", "test-google-secret");
        }

        /// <summary>After a successful collect a session exists, so only the error answer is checked.</summary>
        private static async Task AssertFailedNoSessionCheck(HttpResponseMessage response)
        {
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("providerSignInFailed", (await SignInApi.Json(response)).Str("code"));
        }
    }
}
