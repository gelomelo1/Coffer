using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Coffer.BusinessLogic.DevSeed;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Marketplace.Listings;
using Coffer.BusinessLogic.Services;
using Coffer.Domain.Entities;
using Coffer.Domain.Moderation;
using Coffer.Tests.Marketplace;

namespace Coffer.Tests.DevSeed
{
    public class SellerCountryFilterTests : MarketplaceTestBase
    {
        private ListingService Listings() => new(Db.Context, Clock, new ImageService(), new MarketplaceStorage(Path.GetTempPath(), Path.GetTempPath()));

        private User UserFrom(string name, string country)
        {
            var user = Db.AddUser(name);
            user.Country = country;
            Db.Context.SaveChanges();
            return user;
        }

        [Fact]
        public async Task Search_FiltersBySellerNationality_OneOrMany_CaseInsensitive()
        {
            var me = Db.AddUser("me");
            AddListing(UserFrom("hun", "HU"));
            AddListing(UserFrom("brit", "GB"));
            AddListing(UserFrom("austrian", "AT"));

            var hungarian = await Listings().SearchAsync(me.Id, new ListingQuery { SellerCountries = { "hu" } });
            Assert.Equal("HU", Assert.Single(hungarian).SellerCountry);

            var two = await Listings().SearchAsync(me.Id, new ListingQuery { SellerCountries = { "HU,GB" } });
            Assert.Equal(new[] { "GB", "HU" }, two.Select(l => l.SellerCountry).OrderBy(c => c).ToArray());

            Assert.Equal(3, (await Listings().SearchAsync(me.Id, new ListingQuery())).Count);
            Assert.Empty(await Listings().SearchAsync(me.Id, new ListingQuery { SellerCountries = { "FR" } }));
        }

        [Theory]
        [InlineData("Hungary")]
        [InlineData("H1")]
        [InlineData("HUN")]
        public async Task Search_RejectsNonIsoCodes(string code)
        {
            var me = Db.AddUser("me");
            var e = await Assert.ThrowsAsync<MarketplaceException>(() => Listings().SearchAsync(me.Id, new ListingQuery { SellerCountries = { code } }));
            Assert.Equal(MarketplaceError.Validation, e.Error);
        }
    }

    /// <summary>Changes process-wide env vars, so it runs in the serialized "api" collection and restores them.</summary>
    [Collection("api")]
    public class DevLoginApiTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private readonly string? _oldFlag = Environment.GetEnvironmentVariable(DevLoginService.EnvName);
        private readonly string? _oldJson = Environment.GetEnvironmentVariable("DEV_SEED_DATA_JSON");
        private readonly User _seedUser;
        private readonly User _realUser;

        public DevLoginApiTests()
        {
            _seedUser = _api.Db.AddUser("SeedAnna");
            _realUser = _api.Db.AddUser("RealPerson");
            var data = new DevSeedData { Users = { new SeedUser { Id = _seedUser.Id, Name = "SeedAnna", ProviderUserId = "seed-anna" } } };
            Environment.SetEnvironmentVariable("DEV_SEED_DATA_JSON", JsonSerializer.Serialize(data, DevSeedData.Json));
        }

        [Fact]
        public async Task Disabled_EndpointsDontExist()
        {
            Environment.SetEnvironmentVariable(DevLoginService.EnvName, null);
            var client = _api.CreateClient();
            Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("api/auth/dev/users")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsJsonAsync("api/auth/dev/login", new { userId = _seedUser.Id })).StatusCode);
        }

        [Fact]
        public async Task Enabled_ListsOnlySeedUsers_AndIssuesAWorkingToken()
        {
            Environment.SetEnvironmentVariable(DevLoginService.EnvName, "true");
            var client = _api.CreateClient();

            var users = await client.GetFromJsonAsync<List<DevLoginUserDto>>("api/auth/dev/users");
            Assert.Equal(_seedUser.Id, Assert.Single(users!).Id);

            var login = await client.PostAsJsonAsync("api/auth/dev/login", new { userId = _seedUser.Id });
            Assert.Equal(HttpStatusCode.OK, login.StatusCode);
            var token = (await login.Content.ReadFromJsonAsync<DevLoginResultDto>())!.Token;
            var authed = _api.CreateClient();
            authed.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            Assert.Contains("SeedAnna", await authed.GetStringAsync("api/auth/currentUser"));

            // A real (non-seed) account can never be impersonated.
            Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("api/auth/dev/login", new { userId = _realUser.Id })).StatusCode);
        }

        [Fact]
        public async Task Enabled_SuspendedSeedUser_GetsNoToken()
        {
            Environment.SetEnvironmentVariable(DevLoginService.EnvName, "true");
            var admin = _api.Db.AddManagerAdmin();
            _api.Db.Context.UserSuspensions.Add(new UserSuspension
            {
                Id = Guid.NewGuid(), UserId = _seedUser.Id, Reason = "Testing suspension.", StartsAt = DateTime.UtcNow.AddHours(-1),
                EndsAt = DateTime.UtcNow.AddHours(5), CreatedByAdminId = admin.Id, CreatedAt = DateTime.UtcNow,
            });
            _api.Db.Context.SaveChanges();

            var login = await _api.CreateClient().PostAsJsonAsync("api/auth/dev/login", new { userId = _seedUser.Id });
            Assert.Equal(HttpStatusCode.Forbidden, login.StatusCode);
            Assert.Contains("account_suspended", await login.Content.ReadAsStringAsync());
        }

        [Fact]
        public void FlagOutsideDevelopment_FailsStartupGuard()
        {
            Environment.SetEnvironmentVariable(DevLoginService.EnvName, "true");
            Assert.Throws<InvalidOperationException>(() => DevSeedGuard.CheckDevLogin("Production"));
            Assert.False(DevLoginService.IsEnabled("Production"));
            Assert.False(DevLoginService.IsEnabled("Staging"));
            DevSeedGuard.CheckDevLogin("Development");
        }

        public void Dispose()
        {
            Environment.SetEnvironmentVariable(DevLoginService.EnvName, _oldFlag);
            Environment.SetEnvironmentVariable("DEV_SEED_DATA_JSON", _oldJson);
            _api.Dispose();
        }
    }
}
