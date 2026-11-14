using System.Net;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Marketplace.Listings;
using Coffer.BusinessLogic.Services;
using Coffer.Domain.Marketplace;

namespace Coffer.Tests.Marketplace
{
    public class MyListingsFilterTests : MarketplaceTestBase
    {
        private ListingService Listings() => new(Db.Context, Clock, new ImageService(), new MarketplaceStorage(Path.GetTempPath(), Path.GetTempPath()));

        private void Seed()
        {
            var me = Db.Context.Users.Single(u => u.Name == "me");
            AddListing(me, status: ListingStatus.Active);
            AddListing(me, status: ListingStatus.PendingPickup);
            AddListing(me, status: ListingStatus.PendingShipment);
            AddListing(me, status: ListingStatus.Sold);
            AddListing(me, status: ListingStatus.Sold);
            AddListing(me, status: ListingStatus.Archived);
            AddListing(me, status: ListingStatus.Removed);
            AddListing(Db.AddUser("someone-else"), status: ListingStatus.Sold);
        }

        [Fact]
        public async Task Filter_Active_IncludesListingsReservedByAnOpenDeal()
        {
            var me = Db.AddUser("me");
            Seed();

            var active = await Listings().GetMineAsync(me.Id, "active");

            Assert.Equal(3, active.Count);
            Assert.All(active, l => Assert.Contains(l.Status, new[] { ListingStatus.Active, ListingStatus.PendingPickup, ListingStatus.PendingShipment }));
        }

        [Fact]
        public async Task Filter_Sold_OnlyMine()
        {
            var me = Db.AddUser("me");
            Seed();

            var sold = await Listings().GetMineAsync(me.Id, "sold");

            Assert.Equal(2, sold.Count);
            Assert.All(sold, l => Assert.Equal(ListingStatus.Sold, l.Status));
        }

        [Fact]
        public async Task Filter_Archived_IncludesModerationRemovals()
        {
            var me = Db.AddUser("me");
            Seed();

            var archived = await Listings().GetMineAsync(me.Id, "ARCHIVED");

            Assert.Equal(new[] { ListingStatus.Archived, ListingStatus.Removed }, archived.Select(l => l.Status).OrderBy(s => s).ToArray());
        }

        [Fact]
        public async Task NoFilter_ReturnsEverything_CountsMatchFilters_UnknownFilterRejected()
        {
            var me = Db.AddUser("me");
            Seed();

            Assert.Equal(7, (await Listings().GetMineAsync(me.Id)).Count);
            Assert.Equal(7, (await Listings().GetMineAsync(me.Id, "all")).Count);
            var counts = await Listings().CountMineAsync(me.Id);
            Assert.Equal(3, counts["active"]);
            Assert.Equal(2, counts["sold"]);
            Assert.Equal(2, counts["archived"]);
            await Assert.ThrowsAsync<MarketplaceException>(() => Listings().GetMineAsync(me.Id, "deleted"));
        }

        [Fact]
        public async Task EmptyFilter_ReturnsEmptyList()
        {
            var me = Db.AddUser("me");
            AddListing(me, status: ListingStatus.Active);
            Assert.Empty(await Listings().GetMineAsync(me.Id, "sold"));
            Assert.Equal(0, (await Listings().CountMineAsync(me.Id))["archived"]);
        }
    }

    [Collection("api")]
    public class MyListingsFilterApiTests : IDisposable
    {
        private readonly ApiFactory _api = new();

        [Fact]
        public async Task MineEndpoints_FilterAndCount()
        {
            var me = _api.Db.AddUser("me");
            var client = _api.ClientFor(me);

            Assert.Equal("[]", await client.GetStringAsync("api/Listings/Mine?filter=sold"));
            Assert.Contains("\"active\":0", await client.GetStringAsync("api/Listings/Mine/Counts"));
            Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("api/Listings/Mine?filter=nope")).StatusCode);
        }

        public void Dispose() => _api.Dispose();
    }
}
