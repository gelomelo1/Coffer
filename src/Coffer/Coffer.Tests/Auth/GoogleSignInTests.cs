using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Coffer.BusinessLogic.Auth.OAuth;
using Coffer.BusinessLogic.Moderation;
using Google.Apis.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Coffer.Tests.Auth
{
    /// <summary>Stands in for Google: maps a test "ID token" to the identity Google would have verified.</summary>
    public sealed class FakeGoogleValidator : IGoogleIdTokenValidator
    {
        public Dictionary<string, ProviderIdentity> Tokens { get; } = new();

        public Task<ProviderIdentity> ValidateAsync(string idToken) =>
            Tokens.TryGetValue(idToken, out var identity)
                ? Task.FromResult(identity)
                : throw new ProviderSignInException("unknown test token");
    }

    /// <summary>Shared helpers for the sign-in API tests.</summary>
    public static class SignInApi
    {
        public static async Task<JsonElement> Json(HttpResponseMessage response) =>
            JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

        public static string? Str(this JsonElement e, string name) =>
            e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

        public static async Task<HttpStatusCode> CurrentUserStatus(ApiFactory api, string accessToken)
        {
            var client = api.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            return (await client.GetAsync("api/auth/currentUser")).StatusCode;
        }
    }

    public class GoogleSignInTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private readonly FakeGoogleValidator _google = new();
        private readonly HttpClient _client;

        public GoogleSignInTests()
        {
            _api.Overrides = s => s.AddSingleton<IGoogleIdTokenValidator>(_google);
            _client = _api.CreateClient();
        }

        public void Dispose() => _api.Dispose();

        private Task<HttpResponseMessage> Validate(string token) =>
            _client.PostAsJsonAsync("api/auth/google/validate", new { idToken = token });

        private Task<HttpResponseMessage> Register(string? registrationId, string username = "newbie", string country = "HU") =>
            _client.PostAsJsonAsync("api/auth/register", new { registrationId, username, country });

        private void Known(string token, string subject, string? email = "x@example.com") =>
            _google.Tokens[token] = new ProviderIdentity("google", subject, email, "Name", "https://example.com/a.png");

        private async Task<string> RegistrationId(string token)
        {
            var body = await SignInApi.Json(await Validate(token));
            Assert.Equal("registrationRequired", body.Str("status"));
            return body.Str("registrationId")!;
        }

        [Fact]
        public async Task Existing_user_gets_tokens()
        {
            _api.Db.AddUser("anna");
            Known("tok-anna", "sub-anna");

            var response = await Validate("tok-anna");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var body = await SignInApi.Json(response);
            Assert.Equal("signedIn", body.Str("status"));
            Assert.False(string.IsNullOrEmpty(body.Str("refreshToken")));
            Assert.Null(body.Str("registrationId"));
            Assert.Equal(HttpStatusCode.OK, await SignInApi.CurrentUserStatus(_api, body.Str("accessToken")!));
        }

        [Fact]
        public async Task New_identity_gets_registration_id_and_no_tokens()
        {
            Known("tok-new", "sub-new");

            var body = await SignInApi.Json(await Validate("tok-new"));

            Assert.Equal("registrationRequired", body.Str("status"));
            Assert.Equal(43, body.Str("registrationId")!.Length);
            Assert.Null(body.Str("accessToken"));
        }

        [Fact]
        public async Task Register_creates_user_and_tokens()
        {
            Known("tok-new", "sub-new", "new@example.com");
            var id = await RegistrationId("tok-new");

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
            Known("tok-new", "sub-new");
            var id = await RegistrationId("tok-new");

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
            var response = await Register("made-up");

            Assert.Equal("invalidRegistrationSession", (await SignInApi.Json(response)).Str("code"));
        }

        [Theory]
        [InlineData("", "HU", "invalidUsername")]
        [InlineData("has space", "HU", "invalidUsername")]
        [InlineData("<script>", "HU", "invalidUsername")]
        [InlineData("ok_name", "Hungary", "invalidCountry")]
        public async Task Invalid_input_is_rejected_without_consuming_the_handle(string username, string country, string code)
        {
            Known("tok-new", "sub-new");
            var id = await RegistrationId("tok-new");

            var bad = await Register(id, username, country);
            var good = await Register(id);

            Assert.Equal(code, (await SignInApi.Json(bad)).Str("code"));
            Assert.Equal(HttpStatusCode.OK, good.StatusCode);
        }

        [Fact]
        public async Task Taken_username_is_rejected()
        {
            _api.Db.AddUser("anna");
            Known("tok-new", "sub-new");
            var id = await RegistrationId("tok-new");

            var response = await Register(id, "anna");

            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
            Assert.Equal("usernameTaken", (await SignInApi.Json(response)).Str("code"));
        }

        [Fact]
        public async Task Suspended_user_gets_403_and_no_tokens()
        {
            var admin = _api.Db.AddManagerAdmin();
            var user = _api.Db.AddUser("anna");
            using (var scope = _api.Services.CreateScope())
                await scope.ServiceProvider.GetRequiredService<ISuspensionService>()
                    .SuspendAsync(admin.Id, new CreateSuspensionInput(user.Id, 24, "Repeated harassment in comments."));
            Known("tok-anna", "sub-anna");

            var response = await Validate("tok-anna");

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            var body = await SignInApi.Json(response);
            Assert.Equal(SuspensionService.SuspendedCode, body.Str("code"));
            Assert.Null(body.Str("accessToken"));
            Assert.Empty(_api.Db.NewContext().AuthSessions);
        }

        [Fact]
        public async Task Invalid_token_is_providerSignInFailed()
        {
            var response = await Validate("forged");

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("providerSignInFailed", (await SignInApi.Json(response)).Str("code"));
        }

        [Fact]
        public async Task Registration_never_matches_by_email()
        {
            _api.Db.AddUser("anna"); // anna@example.com, subject sub-anna
            Known("tok-other", "sub-someone-else", "anna@example.com");

            var body = await SignInApi.Json(await Validate("tok-other"));

            Assert.Equal("registrationRequired", body.Str("status"));
        }

        [Fact]
        public async Task Same_subject_from_another_provider_is_another_account()
        {
            _api.Db.AddUser("anna"); // google / sub-anna
            _google.Tokens["tok-fb"] = new ProviderIdentity("facebook", "sub-anna", null, null, null);

            var body = await SignInApi.Json(await Validate("tok-fb"));

            Assert.Equal("registrationRequired", body.Str("status"));
        }
    }

    /// <summary>The checks the backend adds on top of Google's own signature/issuer/audience/expiry validation.</summary>
    public class GoogleIdTokenRulesTests
    {
        private static readonly DateTime Now = new(2026, 11, 24, 12, 0, 0, DateTimeKind.Utc);

        private static GoogleJsonWebSignature.Payload Payload(DateTime issuedAt, bool emailVerified = true) => new()
        {
            Subject = "1234567890",
            Email = "anna@example.com",
            EmailVerified = emailVerified,
            Name = "Anna",
            Picture = "https://example.com/anna.png",
            IssuedAtTimeSeconds = new DateTimeOffset(issuedAt).ToUnixTimeSeconds(),
        };

        [Fact]
        public void Fresh_token_gives_the_google_identity()
        {
            var identity = GoogleIdTokenValidator.Accept(Payload(Now.AddMinutes(-1)), Now);

            Assert.Equal(new ProviderIdentity("google", "1234567890", "anna@example.com", "Anna", "https://example.com/anna.png"), identity);
        }

        [Fact]
        public void Token_older_than_ten_minutes_is_rejected() =>
            Assert.Throws<ProviderSignInException>(() => GoogleIdTokenValidator.Accept(Payload(Now.AddMinutes(-11)), Now));

        [Fact]
        public void Token_from_the_future_is_rejected() =>
            Assert.Throws<ProviderSignInException>(() => GoogleIdTokenValidator.Accept(Payload(Now.AddMinutes(5)), Now));

        [Fact]
        public void Unverified_email_is_not_kept() =>
            Assert.Null(GoogleIdTokenValidator.Accept(Payload(Now, emailVerified: false), Now).Email);

        [Fact]
        public void Missing_subject_is_rejected()
        {
            var payload = Payload(Now);
            payload.Subject = null;

            Assert.Throws<ProviderSignInException>(() => GoogleIdTokenValidator.Accept(payload, Now));
        }
    }
}
