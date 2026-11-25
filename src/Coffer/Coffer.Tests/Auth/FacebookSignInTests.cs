using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Coffer.BusinessLogic.Auth.OAuth;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.Tests.Marketplace;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;

namespace Coffer.Tests.Auth
{
    /// <summary>Facebook Login: OIDC authorization code flow with PKCE (S256), state and nonce, ID token checked against Facebook's keys.</summary>
    public class FacebookSignInTests : IDisposable
    {
        private const string Jwks = "https://www.facebook.com/.well-known/oauth/openid/jwks/";
        private const string TokenEndpoint = "https://graph.facebook.com/v21.0/oauth/access_token";
        private const string AppId = TestEnvironment.FacebookAppId;

        private readonly ApiFactory _api = new();
        private readonly FakeHttp _http = new();
        private readonly FakeClock _clock = new() { UtcNow = DateTime.UtcNow };
        private readonly CapturingLoggerProvider _logs = new();
        private readonly TestJwks _key1 = new("k1");
        private readonly TestJwks _key2 = new("k2");
        private readonly HttpClient _client;

        /// <summary>What Facebook's key endpoint publishes.</summary>
        private string _jwks;
        /// <summary>The ID token Facebook's token endpoint returns for a transaction's nonce.</summary>
        private Func<string, string> _idToken;
        private Func<string, (HttpStatusCode, string)>? _tokenResponse;

        public FacebookSignInTests()
        {
            _jwks = TestJwks.Json(_key1);
            _idToken = nonce => _key1.Sign(Claims(nonce));
            _http.Responder = (request, _) =>
            {
                var url = request.RequestUri!.ToString();
                if (url.StartsWith(Jwks)) return (HttpStatusCode.OK, _jwks);
                if (url.StartsWith(TokenEndpoint)) return (HttpStatusCode.OK, "");
                return (HttpStatusCode.NotFound, "{}");
            };
            _api.Overrides = s =>
            {
                s.AddHttpClient<IFacebookOAuthClient, FacebookOAuthClient>().ConfigurePrimaryHttpMessageHandler(() => _http);
                s.AddSingleton<IClock>(_clock);
                s.AddSingleton<ILoggerProvider>(_logs);
            };
            _client = _api.CreateClient();
        }

        public void Dispose() => _api.Dispose();

        private static Dictionary<string, object> Claims(string nonce, string sub = "fb-user-1") => new()
        {
            ["iss"] = "https://www.facebook.com",
            ["aud"] = AppId,
            ["sub"] = sub,
            ["nonce"] = nonce,
            ["name"] = "Anna Facebook",
            ["email"] = "anna@facebook.example",
            ["picture"] = "https://example.com/anna.jpg",
        };

        private sealed record Started(string TransactionId, Uri AuthorizeUrl, Dictionary<string, string> Query, string RedirectUri)
        {
            public string State => Query["state"];
            public string Nonce => Query["nonce"];
        }

        private async Task<Started> Start()
        {
            var response = await _client.PostAsync("api/auth/facebook/start", null);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await SignInApi.Json(response);
            var url = new Uri(body.Str("authorizeUrl")!);
            return new Started(body.Str("transactionId")!, url, FakeHttp.Form(url.Query.TrimStart('?')), body.Str("redirectUri")!);
        }

        private Task<HttpResponseMessage> Complete(Started s, string? state = null, string code = "the-code", string? transactionId = null)
        {
            _http.Responder = Wrap(_http.Responder, s.Nonce);
            return _client.PostAsJsonAsync("api/auth/facebook/complete", new { transactionId = transactionId ?? s.TransactionId, code, state = state ?? s.State });
        }

        /// <summary>The token endpoint answers with the ID token for this transaction's nonce (or a custom answer).</summary>
        private Func<HttpRequestMessage, string, (HttpStatusCode, string)> Wrap(Func<HttpRequestMessage, string, (HttpStatusCode, string)> inner, string nonce) =>
            (request, body) => request.RequestUri!.ToString().StartsWith(TokenEndpoint)
                ? _tokenResponse?.Invoke(nonce) ?? (HttpStatusCode.OK, JsonSerializer.Serialize(new { access_token = "fb-access-token", token_type = "bearer", expires_in = 3600, id_token = _idToken(nonce) }))
                : inner(request, body);

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

            Assert.Equal("https://www.facebook.com/v21.0/dialog/oauth", s.AuthorizeUrl.GetLeftPart(UriPartial.Path));
            Assert.Equal(AppId, s.Query["client_id"]);
            Assert.Equal($"fb{AppId}://authorize", s.Query["redirect_uri"]);
            Assert.Equal($"fb{AppId}://authorize", s.RedirectUri);
            Assert.Equal("code", s.Query["response_type"]);
            Assert.Equal("openid email public_profile", s.Query["scope"]);
            Assert.Equal("S256", s.Query["code_challenge_method"]);
            Assert.Equal(43, s.State.Length);
            Assert.Equal(43, s.Nonce.Length);
            Assert.NotEqual(s.State, s.TransactionId);
            Assert.DoesNotContain(s.TransactionId, s.AuthorizeUrl.ToString());
        }

        [Fact]
        public async Task Happy_path_new_user_needs_registration()
        {
            var s = await Start();

            var body = await SignInApi.Json(await Complete(s));

            Assert.Equal("registrationRequired", body.Str("status"));
            var register = await _client.PostAsJsonAsync("api/auth/register", new { registrationId = body.Str("registrationId"), username = "annafb", country = "HU" });
            Assert.Equal(HttpStatusCode.OK, register.StatusCode);
            var user = await _api.Db.NewContext().Users.SingleAsync(u => u.Name == "annafb");
            Assert.Equal(("facebook", "fb-user-1", "anna@facebook.example"), (user.Provider, user.ProviderUserId, user.Email));
        }

        [Fact]
        public async Task Existing_facebook_user_is_signed_in()
        {
            var user = _api.Db.AddUser("anna");
            user.Provider = "facebook";
            user.ProviderUserId = "fb-user-1";
            _api.Db.Context.SaveChanges();
            var s = await Start();

            var body = await SignInApi.Json(await Complete(s));

            Assert.Equal("signedIn", body.Str("status"));
            Assert.Equal(HttpStatusCode.OK, await SignInApi.CurrentUserStatus(_api, body.Str("accessToken")!));
        }

        [Fact]
        public async Task Token_request_carries_verifier_and_configured_redirect()
        {
            var s = await Start();

            await Complete(s);

            var call = Assert.Single(_http.Calls, c => c.Url.ToString().StartsWith(TokenEndpoint));
            var form = FakeHttp.Form(call.Body);
            Assert.Equal(AppId, form["client_id"]);
            Assert.Equal("test-facebook-secret", form["client_secret"]);
            Assert.Equal($"fb{AppId}://authorize", form["redirect_uri"]);
            Assert.Equal("the-code", form["code"]);
            var challenge = Base64UrlEncoder.Encode(SHA256.HashData(Encoding.ASCII.GetBytes(form["code_verifier"])));
            Assert.Equal(s.Query["code_challenge"], challenge);
        }

        [Fact]
        public async Task Wrong_nonce_fails()
        {
            _idToken = _ => _key1.Sign(Claims("someone-elses-nonce"));

            await AssertFailed(await Complete(await Start()));
        }

        [Fact]
        public async Task Wrong_audience_fails()
        {
            _idToken = nonce => { var c = Claims(nonce); c["aud"] = "999999"; return _key1.Sign(c); };

            await AssertFailed(await Complete(await Start()));
        }

        [Fact]
        public async Task Wrong_issuer_fails()
        {
            _idToken = nonce => { var c = Claims(nonce); c["iss"] = "https://accounts.google.com"; return _key1.Sign(c); };

            await AssertFailed(await Complete(await Start()));
        }

        [Fact]
        public async Task Expired_token_fails()
        {
            _idToken = nonce => _key1.Sign(Claims(nonce), expires: DateTime.UtcNow.AddMinutes(-10), issuedAt: DateTime.UtcNow.AddMinutes(-70));

            await AssertFailed(await Complete(await Start()));
        }

        [Fact]
        public async Task Hs256_token_signed_with_public_key_bytes_fails()
        {
            _idToken = nonce => _key1.SignHs256WithPublicKey(Claims(nonce));

            await AssertFailed(await Complete(await Start()));
        }

        [Fact]
        public async Task Unknown_kid_does_not_hammer_the_key_endpoint()
        {
            _idToken = nonce => _key2.Sign(Claims(nonce)); // Facebook publishes only key1

            await AssertFailed(await Complete(await Start()));
            await AssertFailed(await Complete(await Start()));

            Assert.Equal(1, _http.CallsTo(Jwks));
        }

        [Fact]
        public async Task Rotated_key_is_picked_up_after_refetch()
        {
            var first = await SignInApi.Json(await Complete(await Start()));
            Assert.Equal("registrationRequired", first.Str("status"));

            _jwks = TestJwks.Json(_key1, _key2);
            _idToken = nonce => _key2.Sign(Claims(nonce));
            _clock.Advance(TimeSpan.FromMinutes(6));

            var second = await SignInApi.Json(await Complete(await Start()));
            Assert.Equal("registrationRequired", second.Str("status"));
            Assert.Equal(2, _http.CallsTo(Jwks));
        }

        [Fact]
        public async Task State_mismatch_fails_and_consumes_transaction()
        {
            var s = await Start();

            await AssertFailed(await Complete(s, state: "forged-state"));
            await AssertFailed(await Complete(s));

            Assert.Equal(0, _http.CallsTo(TokenEndpoint));
        }

        [Fact]
        public async Task Replayed_transaction_fails()
        {
            var s = await Start();
            Assert.Equal(HttpStatusCode.OK, (await Complete(s)).StatusCode);

            var replay = await Complete(s);

            Assert.Equal(HttpStatusCode.BadRequest, replay.StatusCode);
            Assert.Equal(1, _http.CallsTo(TokenEndpoint));
        }

        [Fact]
        public async Task Unknown_transaction_fails()
        {
            var s = await Start();

            await AssertFailed(await Complete(s, transactionId: "made-up"));
        }

        [Fact]
        public async Task Transaction_from_other_provider_fails()
        {
            var s = await Start();
            OAuthTransaction discord;
            using (var scope = _api.Services.CreateScope())
                discord = scope.ServiceProvider.GetRequiredService<OAuthTransactionStore>().Create(Providers.Discord, withNonce: false, withPkce: true);

            await AssertFailed(await Complete(s, state: discord.State, transactionId: discord.Id));
        }

        [Fact]
        public async Task Malformed_token_response_fails_cleanly()
        {
            _tokenResponse = _ => (HttpStatusCode.OK, "this is not json");

            await AssertFailed(await Complete(await Start()));
        }

        [Fact]
        public async Task Token_response_without_id_token_fails()
        {
            _tokenResponse = _ => (HttpStatusCode.OK, "{\"access_token\":\"x\"}");

            await AssertFailed(await Complete(await Start()));
        }

        [Fact]
        public async Task Facebook_error_response_fails_cleanly()
        {
            _tokenResponse = _ => (HttpStatusCode.BadRequest, "{\"error\":{\"message\":\"Invalid verification code\",\"code\":100}}");

            await AssertFailed(await Complete(await Start()));
        }

        [Fact]
        public async Task Logs_never_contain_code_or_tokens()
        {
            string? idToken = null;
            _idToken = nonce => idToken = _key1.Sign(Claims("wrong-nonce"));
            var s = await Start();

            await Complete(s, code: "SECRET-CODE-123");

            var log = string.Join("\n", _logs.Lines);
            Assert.Contains("facebook sign-in failed", log, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("SECRET-CODE-123", log);
            Assert.DoesNotContain(idToken!, log);
            Assert.DoesNotContain("fb-access-token", log);
            Assert.DoesNotContain("test-facebook-secret", log);
        }
    }
}
