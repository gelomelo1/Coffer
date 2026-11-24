using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using Coffer.BusinessLogic.Auth;
using Coffer.BusinessLogic.Auth.OAuth;
using Coffer.BusinessLogic.Auth.Sessions;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.Tests.Marketplace;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.IdentityModel.Tokens;

namespace Coffer.Tests.Auth
{
    /// <summary>Rotating, hashed, single-use refresh tokens bound to a server-side session.</summary>
    public class SessionServiceTests : IDisposable
    {
        private readonly TestDb _db = new();
        private readonly FakeClock _clock = new() { UtcNow = DateTime.UtcNow };
        private readonly SessionGuardCache _cache = new(new MemoryCache(new MemoryCacheOptions()));
        private static readonly AuthOptions Options = LoadOptions();

        // Field initialisers run before a static constructor body, so the test environment is set up here.
        private static AuthOptions LoadOptions()
        {
            TestEnvironment.Ensure();
            return AuthOptions.FromEnvironment(Environment.GetEnvironmentVariable);
        }

        private SessionService Sut(Coffer.DataAccess.CofferDbContext? db = null) =>
            new(db ?? _db.Context, new AccessTokenIssuer(Options, _clock), _cache, _clock, NullLogger<SessionService>.Instance);

        public void Dispose() => _db.Dispose();

        private static Task<MarketplaceException> Fails(Func<Task> act) => Assert.ThrowsAsync<MarketplaceException>(act);

        [Fact]
        public async Task Issue_stores_only_the_hash()
        {
            var user = _db.AddUser("anna");

            var tokens = await Sut().IssueAsync(user.Id);

            using var check = _db.NewContext();
            var row = Assert.Single(check.AuthRefreshTokens);
            Assert.Equal(SecureRandom.Sha256Hex(tokens.RefreshToken), row.TokenHash);
            Assert.NotEqual(tokens.RefreshToken, row.TokenHash);
            Assert.Equal(user.Id, Assert.Single(check.AuthSessions).UserId);
        }

        [Fact]
        public async Task Access_token_carries_sid_and_lasts_15_minutes()
        {
            var user = _db.AddUser("anna");

            var tokens = await Sut().IssueAsync(user.Id);

            var jwt = new JwtSecurityTokenHandler().ReadJwtToken(tokens.AccessToken);
            var session = Assert.Single(_db.NewContext().AuthSessions);
            Assert.Equal(session.Id.ToString(), jwt.Claims.Single(c => c.Type == "sid").Value);
            Assert.Equal(user.Id.ToString(), jwt.Subject);
            Assert.Equal("HS256", jwt.Header.Alg);
            Assert.DoesNotContain(jwt.Claims, c => c.Type is "email" or "provider");
            Assert.Equal(_clock.UtcNow.AddMinutes(15), tokens.AccessTokenExpiresAt, TimeSpan.FromSeconds(1));
        }

        [Fact]
        public async Task Refresh_rotates_and_old_token_stops_working()
        {
            var user = _db.AddUser("anna");
            var first = await Sut().IssueAsync(user.Id);

            var second = await Sut().RefreshAsync(first.RefreshToken);

            Assert.NotEqual(first.RefreshToken, second.RefreshToken);
            Assert.Equal("invalidRefreshToken", (await Fails(() => Sut().RefreshAsync(first.RefreshToken))).Code);
        }

        [Fact]
        public async Task Reuse_of_consumed_token_revokes_session()
        {
            var user = _db.AddUser("anna");
            var first = await Sut().IssueAsync(user.Id);
            var second = await Sut().RefreshAsync(first.RefreshToken);

            await Fails(() => Sut().RefreshAsync(first.RefreshToken));

            await Fails(() => Sut().RefreshAsync(second.RefreshToken));
            var session = Assert.Single(_db.NewContext().AuthSessions);
            Assert.NotNull(session.RevokedAt);
            Assert.Equal("reuse", session.RevokeReason);
            Assert.False(await Sut().IsActiveAsync(session.Id));
        }

        [Fact]
        public async Task A_token_can_be_consumed_only_once()
        {
            var user = _db.AddUser("anna");
            await Sut().IssueAsync(user.Id);
            var tokenId = _db.NewContext().AuthRefreshTokens.Single().Id;

            // Two parallel refreshes both read the token before either writes: the conditional update lets one win.
            Assert.True(await Sut(_db.NewContext()).TryConsumeAsync(tokenId));
            Assert.False(await Sut(_db.NewContext()).TryConsumeAsync(tokenId));
        }

        [Fact]
        public async Task Unknown_token_fails()
        {
            Assert.Equal("invalidRefreshToken", (await Fails(() => Sut().RefreshAsync("not-a-token"))).Code);
        }

        [Fact]
        public async Task Idle_expiry()
        {
            var user = _db.AddUser("anna");
            var tokens = await Sut().IssueAsync(user.Id);

            _clock.Advance(TimeSpan.FromDays(15));

            await Fails(() => Sut().RefreshAsync(tokens.RefreshToken));
        }

        [Fact]
        public async Task Absolute_expiry()
        {
            var user = _db.AddUser("anna");
            var tokens = await Sut().IssueAsync(user.Id);
            for (var day = 10; day <= 50; day += 10)
            {
                _clock.Advance(TimeSpan.FromDays(10));
                tokens = await Sut().RefreshAsync(tokens.RefreshToken);
            }

            _clock.Advance(TimeSpan.FromDays(11)); // day 61: past the 60-day session limit, though used 11 days ago

            await Fails(() => Sut().RefreshAsync(tokens.RefreshToken));
        }

        [Fact]
        public async Task Deleted_user_cannot_refresh()
        {
            var user = _db.AddUser("anna");
            var tokens = await Sut().IssueAsync(user.Id);
            user.DeletedAt = _clock.UtcNow;
            _db.Context.SaveChanges();

            await Fails(() => Sut().RefreshAsync(tokens.RefreshToken));
        }

        [Fact]
        public async Task Revoke_all_for_user_revokes_every_session()
        {
            var user = _db.AddUser("anna");
            var other = _db.AddUser("bence");
            var a = await Sut().IssueAsync(user.Id);
            var b = await Sut().IssueAsync(user.Id);
            var keep = await Sut().IssueAsync(other.Id);

            await Sut().RevokeAllForUserAsync(user.Id, "account_deleted");

            await Fails(() => Sut().RefreshAsync(a.RefreshToken));
            await Fails(() => Sut().RefreshAsync(b.RefreshToken));
            await Sut().RefreshAsync(keep.RefreshToken);
        }

        [Fact]
        public async Task Revoke_by_refresh_token_ends_that_session_only()
        {
            var user = _db.AddUser("anna");
            var a = await Sut().IssueAsync(user.Id);
            var b = await Sut().IssueAsync(user.Id);

            await Sut().RevokeByRefreshTokenAsync(a.RefreshToken, "logout");
            await Sut().RevokeByRefreshTokenAsync("unknown", "logout");

            await Fails(() => Sut().RefreshAsync(a.RefreshToken));
            await Sut().RefreshAsync(b.RefreshToken);
        }
    }

    /// <summary>Every user request must carry the access token of a live session.</summary>
    public class SessionGuardApiTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        public void Dispose() => _api.Dispose();

        private static string Sign(IEnumerable<Claim> claims, string alg, DateTime expires, DateTime? notBefore = null)
        {
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Environment.GetEnvironmentVariable("JWT_SECRET")!));
            var token = new JwtSecurityToken("coffer.backend", "coffer.backend", claims, notBefore ?? expires.AddMinutes(-15), expires,
                new SigningCredentials(key, alg));
            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        private async Task<HttpResponseMessage> CurrentUser(string token)
        {
            var client = _api.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            return await client.GetAsync("api/auth/currentUser");
        }

        private async Task<SessionTokens> Issue(Coffer.Domain.Entities.User user)
        {
            using var scope = _api.Services.CreateScope();
            return await scope.ServiceProvider.GetRequiredService<ISessionService>().IssueAsync(user.Id);
        }

        [Fact]
        public async Task Valid_session_token_is_accepted()
        {
            var user = _api.Db.AddUser("anna");
            var tokens = await Issue(user);

            Assert.Equal(HttpStatusCode.OK, (await CurrentUser(tokens.AccessToken)).StatusCode);
        }

        [Fact]
        public async Task Token_without_sid_is_rejected()
        {
            var user = _api.Db.AddUser("anna");
            var token = Sign(new[] { new Claim("sub", user.Id.ToString()) }, SecurityAlgorithms.HmacSha256, DateTime.UtcNow.AddMinutes(10));

            var response = await CurrentUser(token);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            Assert.Contains("sessionRevoked", await response.Content.ReadAsStringAsync());
        }

        [Fact]
        public async Task Token_with_unknown_sid_is_rejected()
        {
            var user = _api.Db.AddUser("anna");
            var token = Sign(new[] { new Claim("sub", user.Id.ToString()), new Claim("sid", Guid.NewGuid().ToString()) },
                SecurityAlgorithms.HmacSha256, DateTime.UtcNow.AddMinutes(10));

            Assert.Equal(HttpStatusCode.Unauthorized, (await CurrentUser(token)).StatusCode);
        }

        [Fact]
        public async Task Revoked_session_token_is_rejected()
        {
            var user = _api.Db.AddUser("anna");
            var tokens = await Issue(user);
            using (var scope = _api.Services.CreateScope())
                await scope.ServiceProvider.GetRequiredService<ISessionService>().RevokeByRefreshTokenAsync(tokens.RefreshToken, "logout");

            var response = await CurrentUser(tokens.AccessToken);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            Assert.Contains("sessionRevoked", await response.Content.ReadAsStringAsync());
        }

        [Fact]
        public async Task Token_signed_with_other_algorithm_is_rejected()
        {
            var user = _api.Db.AddUser("anna");
            await Issue(user);
            var sid = _api.Db.NewContext().AuthSessions.Single().Id;
            // Same key, valid claims, but HS512: built by hand (the library refuses HS512 keys under 64 bytes even to sign).
            var now = EpochTime.GetIntDate(DateTime.UtcNow);
            string Part(string json) => Base64UrlEncoder.Encode(Encoding.UTF8.GetBytes(json));
            var unsigned = Part("{\"alg\":\"HS512\",\"typ\":\"JWT\"}") + "." + Part(
                $"{{\"sub\":\"{user.Id}\",\"sid\":\"{sid}\",\"iss\":\"coffer.backend\",\"aud\":\"coffer.backend\",\"nbf\":{now - 60},\"exp\":{now + 600}}}");
            using var hmac = new System.Security.Cryptography.HMACSHA512(Encoding.UTF8.GetBytes(Environment.GetEnvironmentVariable("JWT_SECRET")!));
            var token = unsigned + "." + Base64UrlEncoder.Encode(hmac.ComputeHash(Encoding.UTF8.GetBytes(unsigned)));

            Assert.Equal(HttpStatusCode.Unauthorized, (await CurrentUser(token)).StatusCode);
        }

        [Fact]
        public async Task Unsigned_token_is_rejected()
        {
            var user = _api.Db.AddUser("anna");
            await Issue(user);
            var sid = _api.Db.NewContext().AuthSessions.Single().Id;
            var now = EpochTime.GetIntDate(DateTime.UtcNow);
            string Part(string json) => Base64UrlEncoder.Encode(Encoding.UTF8.GetBytes(json));
            var token = Part("{\"alg\":\"none\",\"typ\":\"JWT\"}") + "." + Part(
                $"{{\"sub\":\"{user.Id}\",\"sid\":\"{sid}\",\"iss\":\"coffer.backend\",\"aud\":\"coffer.backend\",\"nbf\":{now - 60},\"exp\":{now + 600}}}") + ".";

            Assert.Equal(HttpStatusCode.Unauthorized, (await CurrentUser(token)).StatusCode);
        }

        [Fact]
        public async Task Expired_access_token_is_rejected()
        {
            var user = _api.Db.AddUser("anna");
            await Issue(user);
            var sid = _api.Db.NewContext().AuthSessions.Single().Id;
            var token = Sign(new[] { new Claim("sub", user.Id.ToString()), new Claim("sid", sid.ToString()) },
                SecurityAlgorithms.HmacSha256, DateTime.UtcNow.AddMinutes(-2));

            Assert.Equal(HttpStatusCode.Unauthorized, (await CurrentUser(token)).StatusCode);
        }
    }
}
