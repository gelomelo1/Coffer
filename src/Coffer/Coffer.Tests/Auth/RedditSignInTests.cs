using System.Net;
using System.Net.Http.Json;
using System.Text;
using Coffer.BusinessLogic.Auth.OAuth;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Coffer.Tests.Auth
{
    /// <summary>Reddit: authorization code with state, confidential "web app" client, identity = Reddit's account id.</summary>
    public class RedditSignInTests : IDisposable
    {
        private const string TokenEndpoint = "https://www.reddit.com/api/v1/access_token";
        private const string Me = "https://oauth.reddit.com/api/v1/me";
        private const string Revoke = "https://www.reddit.com/api/v1/revoke_token";
        private const string Redirect = "com.gelomelo.coffer://oauth/reddit";

        private readonly ApiFactory _api = new();
        private readonly FakeHttp _http = new();
        private readonly HttpClient _client;

        private (HttpStatusCode, string) _token = (HttpStatusCode.OK, "{\"access_token\":\"reddit-access-token\",\"token_type\":\"bearer\",\"expires_in\":3600,\"scope\":\"identity\"}");
        private (HttpStatusCode, string) _me = (HttpStatusCode.OK, "{\"id\":\"t2abc\",\"name\":\"anna_reddit\",\"icon_img\":\"https://styles.redditmedia.com/a.png?width=256&amp;s=x\"}");

        public RedditSignInTests()
        {
            _http.Responder = (request, _) =>
            {
                var url = request.RequestUri!.ToString();
                if (url.StartsWith(TokenEndpoint)) return _token;
                if (url.StartsWith(Me)) return _me;
                if (url.StartsWith(Revoke)) return (HttpStatusCode.NoContent, "");
                return (HttpStatusCode.NotFound, "{}");
            };
            _api.Overrides = s => s.AddHttpClient<IRedditOAuthClient, RedditOAuthClient>().ConfigurePrimaryHttpMessageHandler(() => _http);
            _client = _api.CreateClient();
        }

        public void Dispose() => _api.Dispose();

        private async Task<(string Id, Dictionary<string, string> Query, Uri Url, string RedirectUri)> Start()
        {
            var body = await SignInApi.Json(await _client.PostAsync("api/auth/reddit/start", null));
            var url = new Uri(body.Str("authorizeUrl")!);
            return (body.Str("transactionId")!, FakeHttp.Form(url.Query.TrimStart('?')), url, body.Str("redirectUri")!);
        }

        private async Task<HttpResponseMessage> Complete(string? state = null, string? transactionId = null)
        {
            var s = await Start();
            return await _client.PostAsJsonAsync("api/auth/reddit/complete", new { transactionId = transactionId ?? s.Id, code = "reddit-code", state = state ?? s.Query["state"] });
        }

        private async Task AssertFailed(HttpResponseMessage response)
        {
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("providerSignInFailed", (await SignInApi.Json(response)).Str("code"));
            Assert.Empty(_api.Db.NewContext().AuthSessions);
        }

        [Fact]
        public async Task Start_builds_url_from_server_config()
        {
            var s = await Start();

            Assert.Equal("https://www.reddit.com/api/v1/authorize.compact", s.Url.GetLeftPart(UriPartial.Path));
            Assert.Equal("test-reddit-id", s.Query["client_id"]);
            Assert.Equal("code", s.Query["response_type"]);
            Assert.Equal(Redirect, s.Query["redirect_uri"]);
            Assert.Equal(Redirect, s.RedirectUri);
            Assert.Equal("temporary", s.Query["duration"]);
            Assert.Equal("identity", s.Query["scope"]);
            Assert.Equal(43, s.Query["state"].Length);
            Assert.DoesNotContain(s.Id, s.Url.ToString());
        }

        [Fact]
        public async Task Happy_path_existing_user_signed_in_by_account_id()
        {
            var user = _api.Db.AddUser("anna");
            user.Provider = "reddit";
            user.ProviderUserId = "t2abc";
            _api.Db.Context.SaveChanges();

            var body = await SignInApi.Json(await Complete());

            Assert.Equal("signedIn", body.Str("status"));
            Assert.Equal(HttpStatusCode.OK, await SignInApi.CurrentUserStatus(_api, body.Str("accessToken")!));
        }

        [Fact]
        public async Task New_user_registers_with_reddit_id_and_no_email()
        {
            var body = await SignInApi.Json(await Complete());
            var register = await _client.PostAsJsonAsync("api/auth/register", new { registrationId = body.Str("registrationId"), username = "annar", country = "AT" });

            Assert.Equal(HttpStatusCode.OK, register.StatusCode);
            var user = await _api.Db.NewContext().Users.SingleAsync(u => u.Name == "annar");
            Assert.Equal(("reddit", "t2abc", ""), (user.Provider, user.ProviderUserId, user.Email));
            Assert.Equal("https://styles.redditmedia.com/a.png", user.Avatar);
        }

        [Fact]
        public async Task Token_request_uses_basic_auth_configured_redirect_and_user_agent()
        {
            await Complete();

            var call = Assert.Single(_http.Calls, c => c.Url.ToString().StartsWith(TokenEndpoint));
            var expected = "Basic " + Convert.ToBase64String(Encoding.UTF8.GetBytes("test-reddit-id:test-reddit-secret"));
            Assert.Equal(expected, call.Authorization);
            Assert.Contains("com.gelomelo.coffer", call.UserAgent);
            var form = FakeHttp.Form(call.Body);
            Assert.Equal("authorization_code", form["grant_type"]);
            Assert.Equal("reddit-code", form["code"]);
            Assert.Equal(Redirect, form["redirect_uri"]);
            var me = Assert.Single(_http.Calls, c => c.Url.ToString().StartsWith(Me));
            Assert.Equal("Bearer reddit-access-token", me.Authorization);
        }

        [Fact]
        public async Task Access_token_is_revoked_after_use()
        {
            await Complete();

            var call = Assert.Single(_http.Calls, c => c.Url.ToString().StartsWith(Revoke));
            var form = FakeHttp.Form(call.Body);
            Assert.Equal("reddit-access-token", form["token"]);
            Assert.Equal("access_token", form["token_type_hint"]);
        }

        [Fact]
        public async Task State_mismatch_fails()
        {
            await AssertFailed(await Complete(state: "forged"));

            Assert.Equal(0, _http.CallsTo(TokenEndpoint));
        }

        [Fact]
        public async Task Replayed_transaction_fails()
        {
            var s = await Start();
            var request = new { transactionId = s.Id, code = "reddit-code", state = s.Query["state"] };
            Assert.Equal(HttpStatusCode.OK, (await _client.PostAsJsonAsync("api/auth/reddit/complete", request)).StatusCode);

            var replay = await _client.PostAsJsonAsync("api/auth/reddit/complete", request);

            Assert.Equal(HttpStatusCode.BadRequest, replay.StatusCode);
            Assert.Equal(1, _http.CallsTo(TokenEndpoint));
        }

        [Fact]
        public async Task Facebook_transaction_is_not_accepted_for_reddit()
        {
            OAuthTransaction facebook;
            using (var scope = _api.Services.CreateScope())
                facebook = scope.ServiceProvider.GetRequiredService<OAuthTransactionStore>().Create(Providers.Facebook, withNonceAndPkce: true);

            await AssertFailed(await Complete(state: facebook.State, transactionId: facebook.Id));
        }

        [Fact]
        public async Task Reddit_error_response_fails_cleanly()
        {
            _token = (HttpStatusCode.OK, "{\"error\":\"invalid_grant\"}");

            await AssertFailed(await Complete());
        }

        [Fact]
        public async Task Reddit_me_failure_fails_cleanly()
        {
            _me = (HttpStatusCode.InternalServerError, "oops");

            await AssertFailed(await Complete());
        }

        [Fact]
        public async Task Missing_id_fails()
        {
            _me = (HttpStatusCode.OK, "{\"name\":\"anna_reddit\"}");

            await AssertFailed(await Complete());
        }

        [Fact]
        public async Task Malformed_json_fails_cleanly()
        {
            _token = (HttpStatusCode.OK, "<html>");

            await AssertFailed(await Complete());
        }
    }
}
