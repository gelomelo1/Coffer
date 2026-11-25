using System.Net;
using System.Net.Http.Json;
using System.Text;
using Coffer.BusinessLogic.Auth.OAuth;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Coffer.Tests.Auth
{
    /// <summary>Discord: authorization code + PKCE S256 + state, confidential client, identity = Discord user id.</summary>
    public class DiscordSignInTests : BrowserSignInTestBase
    {
        private const string TokenEndpoint = "https://discord.com/api/v10/oauth2/token";
        private const string RevokeEndpoint = "https://discord.com/api/v10/oauth2/token/revoke";
        private const string Me = "https://discord.com/api/v10/users/@me";
        private static readonly string Redirect = $"discord-{TestEnvironment.DiscordClientId}:/authorize/callback";

        protected override string Provider => "discord";

        private (HttpStatusCode, string) _token = (HttpStatusCode.OK, "{\"access_token\":\"discord-access-token\",\"token_type\":\"Bearer\",\"expires_in\":604800,\"scope\":\"identify email\"}");
        private (HttpStatusCode, string) _me = (HttpStatusCode.OK,
            "{\"id\":\"80351110224678912\",\"username\":\"anna_dc\",\"global_name\":\"Anna\",\"avatar\":\"8342729096ea3675442027381ff50dfe\",\"email\":\"anna@discord.example\",\"verified\":true}");

        public DiscordSignInTests()
        {
            Http.Responder = (request, _) =>
            {
                var url = request.RequestUri!.ToString();
                if (url.StartsWith(RevokeEndpoint)) return (HttpStatusCode.OK, "{}");
                if (url.StartsWith(TokenEndpoint)) return _token;
                if (url.StartsWith(Me)) return _me;
                return (HttpStatusCode.NotFound, "{}");
            };
            Init(s => s.AddHttpClient<IDiscordOAuthClient, DiscordOAuthClient>().ConfigurePrimaryHttpMessageHandler(() => Http));
        }

        [Fact]
        public async Task Start_builds_url_from_server_config()
        {
            var s = await Start();

            Assert.Equal("https://discord.com/oauth2/authorize", s.Url.GetLeftPart(UriPartial.Path));
            Assert.Equal(TestEnvironment.DiscordClientId, s.Query["client_id"]);
            Assert.Equal("code", s.Query["response_type"]);
            Assert.Equal(Redirect, s.Query["redirect_uri"]);
            Assert.Equal(Redirect, s.RedirectUri);
            Assert.Equal("identify email", s.Query["scope"]);
            Assert.Equal("S256", s.Query["code_challenge_method"]);
            Assert.Equal(43, s.Query["code_challenge"].Length);
            Assert.Equal(43, s.State.Length);
            Assert.DoesNotContain(s.Id, s.Url.ToString());
        }

        [Fact]
        public async Task Token_request_carries_verifier_redirect_and_client_auth()
        {
            var s = await Start();
            await Complete(s);

            var call = Assert.Single(Http.Calls, c => c.Url.ToString() == TokenEndpoint);
            Assert.Equal("Basic " + Convert.ToBase64String(Encoding.UTF8.GetBytes($"{TestEnvironment.DiscordClientId}:test-discord-secret")), call.Authorization);
            var form = FakeHttp.Form(call.Body);
            Assert.Equal("authorization_code", form["grant_type"]);
            Assert.Equal("the-code", form["code"]);
            Assert.Equal(Redirect, form["redirect_uri"]);
            Assert.Equal(s.Query["code_challenge"], S256(form["code_verifier"]));
            Assert.Equal("Bearer discord-access-token", Assert.Single(Http.Calls, c => c.Url.ToString() == Me).Authorization);
            // Discord requires a User-Agent on every API call.
            Assert.All(Http.Calls, c => Assert.StartsWith("Coffer", c.UserAgent));
        }

        [Fact]
        public async Task New_user_registers_with_discord_id_verified_email_and_avatar()
        {
            var body = await SignInApi.Json(await StartAndComplete());
            var register = await Client.PostAsJsonAsync("api/auth/register", new { registrationId = body.Str("registrationId"), username = "annadc", country = "HU" });

            Assert.Equal(HttpStatusCode.OK, register.StatusCode);
            var user = await Api.Db.NewContext().Users.SingleAsync(u => u.Name == "annadc");
            Assert.Equal(("discord", "80351110224678912", "anna@discord.example"), (user.Provider, user.ProviderUserId, user.Email));
            Assert.Equal("https://cdn.discordapp.com/avatars/80351110224678912/8342729096ea3675442027381ff50dfe.png", user.Avatar);
        }

        [Fact]
        public async Task Existing_user_signed_in_by_id_not_username()
        {
            var user = Api.Db.AddUser("anna");
            user.Provider = "discord";
            user.ProviderUserId = "80351110224678912";
            Api.Db.Context.SaveChanges();

            var body = await SignInApi.Json(await StartAndComplete());

            Assert.Equal("signedIn", body.Str("status"));
        }

        [Fact]
        public async Task Unverified_email_is_not_kept()
        {
            _me = (HttpStatusCode.OK, "{\"id\":\"42\",\"username\":\"x\",\"email\":\"someone@example.com\",\"verified\":false}");

            var body = await SignInApi.Json(await StartAndComplete());
            await Client.PostAsJsonAsync("api/auth/register", new { registrationId = body.Str("registrationId"), username = "xdc", country = "HU" });

            Assert.Equal("", (await Api.Db.NewContext().Users.SingleAsync(u => u.Name == "xdc")).Email);
        }

        [Fact]
        public async Task Access_token_is_revoked_after_use()
        {
            await StartAndComplete();

            var form = FakeHttp.Form(Assert.Single(Http.Calls, c => c.Url.ToString() == RevokeEndpoint).Body);
            Assert.Equal("discord-access-token", form["token"]);
        }

        [Fact]
        public async Task State_mismatch_fails()
        {
            await AssertFailed(await Complete(await Start(), state: "forged"));
            Assert.Equal(0, Http.Calls.Count(c => c.Url.ToString() == TokenEndpoint));
        }

        [Fact]
        public async Task Replayed_transaction_fails()
        {
            var s = await Start();
            Assert.Equal(HttpStatusCode.OK, (await Complete(s)).StatusCode);

            Assert.Equal(HttpStatusCode.BadRequest, (await Complete(s)).StatusCode);
            Assert.Equal(1, Http.Calls.Count(c => c.Url.ToString() == TokenEndpoint));
        }

        [Fact]
        public async Task Github_transaction_is_not_accepted_for_discord()
        {
            OAuthTransaction github;
            using (var scope = Api.Services.CreateScope())
                github = scope.ServiceProvider.GetRequiredService<OAuthTransactionStore>().Create(Providers.Github, withNonce: false, withPkce: true);

            await AssertFailed(await Complete(await Start(), state: github.State, transactionId: github.Id));
        }

        [Fact]
        public async Task Discord_error_response_fails_cleanly()
        {
            _token = (HttpStatusCode.BadRequest, "{\"error\":\"invalid_grant\"}");

            await AssertFailed(await StartAndComplete());
        }

        [Fact]
        public async Task Malformed_json_fails_cleanly()
        {
            _me = (HttpStatusCode.OK, "<html>");

            await AssertFailed(await StartAndComplete());
        }

        [Fact]
        public async Task Missing_id_fails()
        {
            _me = (HttpStatusCode.OK, "{\"username\":\"anna\"}");

            await AssertFailed(await StartAndComplete());
        }

        [Fact]
        public async Task Outage_fails_cleanly()
        {
            Http.Responder = (_, _) => throw new HttpRequestException("connection refused");

            await AssertFailed(await StartAndComplete());
        }
    }
}
