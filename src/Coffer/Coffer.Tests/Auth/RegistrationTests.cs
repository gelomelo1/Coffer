using System.Net;
using System.Net.Http.Json;
using Coffer.BusinessLogic.Auth.OAuth;
using Coffer.BusinessLogic.Moderation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Coffer.Tests.Auth
{
    /// <summary>
    /// What happens after any provider verified an identity: sign in the existing account (never matched by e-mail), or
    /// register a new one through a single-use, 10-minute registration.
    /// </summary>
    public class RegistrationTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private readonly HttpClient _client;

        public RegistrationTests() => _client = _api.CreateClient();

        public void Dispose() => _api.Dispose();

        private static ProviderIdentity Identity(string subject, string? email = "x@example.com", string provider = "google") =>
            new(provider, subject, email, "Name", "https://example.com/a.png");

        private async Task<SignInResult> Complete(ProviderIdentity identity)
        {
            using var scope = _api.Services.CreateScope();
            return await scope.ServiceProvider.GetRequiredService<ISignInService>().CompleteAsync(identity);
        }

        private async Task<string> RegistrationId(ProviderIdentity identity)
        {
            var result = await Complete(identity);
            Assert.Equal(SignInResult.RegistrationRequired, result.Status);
            return result.RegistrationId!;
        }

        private Task<HttpResponseMessage> Register(string? registrationId, string username = "newbie", string country = "HU") =>
            _client.PostAsJsonAsync("api/auth/register", new { registrationId, username, country });

        [Fact]
        public async Task Existing_user_gets_tokens()
        {
            _api.Db.AddUser("anna"); // google / sub-anna

            var result = await Complete(Identity("sub-anna"));

            Assert.Equal(SignInResult.SignedIn, result.Status);
            Assert.Equal(HttpStatusCode.OK, await SignInApi.CurrentUserStatus(_api, result.Tokens!.AccessToken));
        }

        [Fact]
        public async Task New_identity_gets_a_registration_id_and_no_tokens()
        {
            var result = await Complete(Identity("sub-new"));

            Assert.Equal(SignInResult.RegistrationRequired, result.Status);
            Assert.Equal(43, result.RegistrationId!.Length);
            Assert.Null(result.Tokens);
        }

        [Fact]
        public async Task Register_creates_user_and_tokens()
        {
            var id = await RegistrationId(Identity("sub-new", "new@example.com"));

            var response = await Register(id);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await SignInApi.Json(response);
            Assert.Equal(HttpStatusCode.OK, await SignInApi.CurrentUserStatus(_api, body.Str("accessToken")!));
            var user = await _api.Db.NewContext().Users.SingleAsync(u => u.Name == "newbie");
            Assert.Equal(("google", "sub-new", "new@example.com", "HU"), (user.Provider, user.ProviderUserId, user.Email, user.Country));
        }

        [Fact]
        public async Task Register_handle_is_single_use()
        {
            var id = await RegistrationId(Identity("sub-new"));

            var first = await Register(id);
            var second = await Register(id, "other");

            Assert.Equal(HttpStatusCode.OK, first.StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
            Assert.Equal("invalidRegistrationSession", (await SignInApi.Json(second)).Str("code"));
            Assert.Equal(1, await _api.Db.NewContext().Users.CountAsync(u => u.ProviderUserId == "sub-new"));
        }

        [Fact]
        public async Task Unknown_registration_id_fails()
        {
            Assert.Equal("invalidRegistrationSession", (await SignInApi.Json(await Register("made-up"))).Str("code"));
        }

        [Theory]
        [InlineData("", "HU", "invalidUsername")]
        [InlineData("has space", "HU", "invalidUsername")]
        [InlineData("<script>", "HU", "invalidUsername")]
        [InlineData("ok_name", "Hungary", "invalidCountry")]
        public async Task Invalid_input_is_rejected_without_consuming_the_handle(string username, string country, string code)
        {
            var id = await RegistrationId(Identity("sub-new"));

            var bad = await Register(id, username, country);
            var good = await Register(id);

            Assert.Equal(code, (await SignInApi.Json(bad)).Str("code"));
            Assert.Equal(HttpStatusCode.OK, good.StatusCode);
        }

        [Fact]
        public async Task Taken_username_is_rejected()
        {
            _api.Db.AddUser("anna");
            var id = await RegistrationId(Identity("sub-new"));

            var response = await Register(id, "anna");

            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
            Assert.Equal("usernameTaken", (await SignInApi.Json(response)).Str("code"));
        }

        [Fact]
        public async Task Suspended_user_gets_no_tokens()
        {
            var admin = _api.Db.AddManagerAdmin();
            var user = _api.Db.AddUser("anna");
            using (var scope = _api.Services.CreateScope())
                await scope.ServiceProvider.GetRequiredService<ISuspensionService>()
                    .SuspendAsync(admin.Id, new CreateSuspensionInput(user.Id, 24, "Repeated harassment in comments."));

            var result = await Complete(Identity("sub-anna"));

            Assert.Equal(SignInResult.Suspended, result.Status);
            Assert.Null(result.Tokens);
            Assert.Empty(_api.Db.NewContext().AuthSessions);
        }

        [Fact]
        public async Task Registration_never_matches_by_email()
        {
            _api.Db.AddUser("anna"); // anna@example.com, subject sub-anna

            var result = await Complete(Identity("sub-someone-else", "anna@example.com"));

            Assert.Equal(SignInResult.RegistrationRequired, result.Status);
        }

        [Fact]
        public async Task Same_subject_from_another_provider_is_another_account()
        {
            _api.Db.AddUser("anna"); // google / sub-anna

            var result = await Complete(Identity("sub-anna", null, "facebook"));

            Assert.Equal(SignInResult.RegistrationRequired, result.Status);
        }
    }
}
