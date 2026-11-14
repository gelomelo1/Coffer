using System.Net;
using System.Net.Http.Json;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Moderation;
using Coffer.Tests.Marketplace;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;

namespace Coffer.Tests.Moderation
{
    public class SuspensionServiceTests : IDisposable
    {
        private readonly TestDb _db = new();
        private readonly FakeClock _clock = new();
        private readonly MemoryCache _cache = new(new MemoryCacheOptions());

        private SuspensionService Sut() => new(_db.Context, _clock, _cache);

        [Fact]
        public async Task Suspend_IsActiveUntilItExpires()
        {
            var admin = _db.AddManagerAdmin();
            var user = _db.AddUser("troll");

            var dto = await Sut().SuspendAsync(admin.Id, new CreateSuspensionInput(user.Id, 48, "Repeated harassment in comments."));

            Assert.Equal("active", dto.Status);
            Assert.Equal(_clock.UtcNow, dto.StartsAt);
            Assert.Equal(_clock.UtcNow.AddHours(48), dto.EndsAt);
            Assert.Equal("octo-admin", dto.CreatedBy!.Login);
            Assert.NotNull(await Sut().GetActiveAsync(user.Id));

            _clock.Advance(TimeSpan.FromHours(48));
            Assert.Null(await Sut().GetActiveAsync(user.Id));
            Assert.Equal("expired", Assert.Single((await Sut().ListAsync("expired", null, 1, 50)).Items).Status);
            Assert.Empty((await Sut().ListAsync("active", null, 1, 50)).Items);
        }

        [Fact]
        public async Task Revoke_EndsActiveSuspension_KeepsHistory_AndIsAudited()
        {
            var admin = _db.AddManagerAdmin();
            var user = _db.AddUser("troll");
            var dto = await Sut().SuspendAsync(admin.Id, new CreateSuspensionInput(user.Id, 24, "Spam in every comment section."));

            var revoked = await Sut().RevokeAsync(admin.Id, dto.Id, new RevokeSuspensionInput("Appeal accepted."));

            Assert.Equal("revoked", revoked.Status);
            Assert.Equal("Appeal accepted.", revoked.RevokeReason);
            Assert.Null(await Sut().GetActiveAsync(user.Id));
            Assert.Equal(MarketplaceError.Conflict, await ErrorOf(() => Sut().RevokeAsync(admin.Id, dto.Id, new RevokeSuspensionInput("Again please."))));
            Assert.Single((await Sut().ListAsync("all", user.Id, 1, 50)).Items);
            var ctx = _db.NewContext();
            Assert.Equal(new[] { "suspension.create", "suspension.revoke" }, ctx.AdminAuditLog.OrderBy(a => a.CreatedAt).ThenBy(a => a.Action).Select(a => a.Action).ToArray());
        }

        [Fact]
        public async Task Suspend_RequiresReasonAndValidDuration()
        {
            var admin = _db.AddManagerAdmin();
            var user = _db.AddUser("troll");

            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().SuspendAsync(admin.Id, new CreateSuspensionInput(user.Id, 24, ""))));
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().SuspendAsync(admin.Id, new CreateSuspensionInput(user.Id, 0, "Valid reason text here."))));
            Assert.Equal(MarketplaceError.Validation, await ErrorOf(() => Sut().SuspendAsync(admin.Id, new CreateSuspensionInput(user.Id, 24 * 366, "Valid reason text here."))));
            Assert.Equal(MarketplaceError.NotFound, await ErrorOf(() => Sut().SuspendAsync(admin.Id, new CreateSuspensionInput(Guid.NewGuid(), 24, "Valid reason text here."))));
        }

        [Fact]
        public async Task SearchUsers_ShowsActiveSuspension()
        {
            var admin = _db.AddManagerAdmin();
            var user = _db.AddUser("troll");
            _db.AddUser("nice");
            await Sut().SuspendAsync(admin.Id, new CreateSuspensionInput(user.Id, 24, "Spam in every comment section."));

            var found = await Sut().SearchUsersAsync("tro", 1, 20);

            var row = Assert.Single(found.Items);
            Assert.NotNull(row.ActiveSuspension);
        }

        private static async Task<MarketplaceError?> ErrorOf(Func<Task> act)
        {
            try { await act(); return null; }
            catch (MarketplaceException e) { return e.Error; }
        }

        public void Dispose() => _db.Dispose();
    }

    [Collection("api")]
    public class SuspensionEnforcementApiTests : IDisposable
    {
        private readonly ApiFactory _api = new();

        public SuspensionEnforcementApiTests()
        {
            _api.Overrides = services => services.AddSingleton(ManagerAdminConfig.Parse("[\"1001\"]"));
        }

        [Fact]
        public async Task SuspendedUser_IsBlockedOnEveryProtectedEndpoint_ButCanReadWhy()
        {
            var admin = _api.Db.AddManagerAdmin("1001");
            var user = _api.Db.AddUser("troll");
            var client = _api.ClientFor(user); // token issued BEFORE the suspension
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("api/Reports/Mine")).StatusCode);
            Assert.Equal(HttpStatusCode.NoContent, (await client.GetAsync("api/Account/Suspension")).StatusCode);

            var created = await _api.ManagerClientFor(admin).PostAsJsonAsync("api/Admin/Suspensions",
                new { userId = user.Id, durationHours = 24, reason = "Harassment in several comments." });
            Assert.Equal(HttpStatusCode.OK, created.StatusCode);

            var blocked = await client.GetAsync("api/Reports/Mine");
            Assert.Equal(HttpStatusCode.Forbidden, blocked.StatusCode);
            var body = await blocked.Content.ReadAsStringAsync();
            Assert.Contains("account_suspended", body);
            Assert.Contains("Harassment in several comments.", body);
            Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("api/Listings/Mine")).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("api/Reports", new { })).StatusCode);

            var why = await client.GetAsync("api/Account/Suspension");
            Assert.Equal(HttpStatusCode.OK, why.StatusCode);
            Assert.Contains("Harassment", await why.Content.ReadAsStringAsync());

            // A brand-new token (signing in again) is blocked as well.
            Assert.Equal(HttpStatusCode.Forbidden, (await _api.ClientFor(user).GetAsync("api/Reports/Mine")).StatusCode);
        }

        [Fact]
        public async Task RevokedSuspension_LiftsTheBlock_AndOtherUsersAreUnaffected()
        {
            var admin = _api.Db.AddManagerAdmin("1001");
            var user = _api.Db.AddUser("troll");
            var other = _api.Db.AddUser("nice");
            var manager = _api.ManagerClientFor(admin);
            var created = await (await manager.PostAsJsonAsync("api/Admin/Suspensions",
                new { userId = user.Id, durationHours = 24, reason = "Harassment in several comments." })).Content.ReadFromJsonAsync<SuspensionDto>();

            Assert.Equal(HttpStatusCode.OK, (await _api.ClientFor(other).GetAsync("api/Reports/Mine")).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await _api.ClientFor(user).GetAsync("api/Reports/Mine")).StatusCode);

            var revoke = await manager.PostAsJsonAsync($"api/Admin/Suspensions/{created!.Id}/Revoke", new { reason = "Appeal accepted." });
            Assert.Equal(HttpStatusCode.OK, revoke.StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await _api.ClientFor(user).GetAsync("api/Reports/Mine")).StatusCode);

            var history = await manager.GetStringAsync($"api/Admin/Users/{user.Id}/Suspensions");
            Assert.Contains("revoked", history);
        }

        [Fact]
        public async Task UserTokens_CantSuspendAnyone()
        {
            var user = _api.Db.AddUser("sneaky", Coffer.Domain.Constants.UserRole.Admin);
            var victim = _api.Db.AddUser("victim");
            var response = await _api.ClientFor(user).PostAsJsonAsync("api/Admin/Suspensions", new { userId = victim.Id, durationHours = 24, reason = "Because I can do it." });
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        public void Dispose() => _api.Dispose();
    }
}
