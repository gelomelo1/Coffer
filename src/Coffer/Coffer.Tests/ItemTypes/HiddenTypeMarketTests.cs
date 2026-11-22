using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Marketplace.Listings;
using Coffer.Domain.Entities;
using Coffer.Domain.Marketplace;
using Coffer.Tests.Deletion;
using Microsoft.Extensions.DependencyInjection;

namespace Coffer.Tests.ItemTypes
{
    /// <summary>
    /// Listings of an unpublished item type vanish from the marketplace; deals already in progress on them, their chats
    /// and reviews keep working until finished (nobody is stranded mid-trade).
    /// </summary>
    [Collection("api")]
    public class HiddenTypeMarketTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private TestDb Db => _api.Db;
        private MarketRows Rows => new(Db);

        private readonly User _seller;
        private readonly User _buyer;
        private readonly CollectionTypeProvided _hiddenType;
        private readonly Listing _shownListing;
        private readonly Listing _hiddenListing;

        public HiddenTypeMarketTests()
        {
            _seller = Db.AddUser("seller");
            _buyer = Db.AddUser("buyer");
            _shownListing = Rows.Listing(_seller, title: "Shown caps");
            _hiddenType = Db.AddCollectionType("Stamps");
            _hiddenListing = Rows.Listing(_seller, title: "Hidden stamps");
            _hiddenListing.CollectionTypeId = _hiddenType.Id;
            Db.Context.SaveChanges();
        }

        private void Hide()
        {
            var type = Db.Context.CollectionTypes.Single(t => t.Id == _hiddenType.Id);
            type.Published = false;
            Db.Context.SaveChanges();
        }

        private async Task<string> Get(User user, string url)
        {
            var response = await _api.ClientFor(user).GetAsync(url);
            Assert.True(response.IsSuccessStatusCode, $"{url} → {(int)response.StatusCode}");
            return await response.Content.ReadAsStringAsync();
        }

        [Fact]
        public async Task BrowseAndMineOmitHiddenListings()
        {
            Hide();

            var browse = await Get(_buyer, "api/Listings");
            var mine = await Get(_seller, "api/Listings/Mine");
            var counts = JsonDocument.Parse(await Get(_seller, "api/Listings/Mine/Counts")).RootElement;

            Assert.Contains(_shownListing.Id.ToString(), browse);
            Assert.DoesNotContain(_hiddenListing.Id.ToString(), browse);
            Assert.Contains(_shownListing.Id.ToString(), mine);
            Assert.DoesNotContain(_hiddenListing.Id.ToString(), mine);
            Assert.Equal(1, counts.GetProperty("active").GetInt32());
        }

        [Fact]
        public async Task HiddenListingDetailIs404()
        {
            Hide();

            Assert.Equal(HttpStatusCode.NotFound, (await _api.ClientFor(_buyer).GetAsync($"api/Listings/{_hiddenListing.Id}")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await _api.ClientFor(_seller).GetAsync($"api/Listings/{_hiddenListing.Id}")).StatusCode);
        }

        [Fact]
        public async Task CantCreateOrEditListingOfHiddenType()
        {
            Hide();
            using var scope = _api.Services.CreateScope();
            var listings = scope.ServiceProvider.GetRequiredService<IListingService>();
            var input = new ListingInput(ListingKind.Sell, _hiddenType.Id, "New stamps", "Two stamps", 2500, null, ListingCondition.Good,
                Db.Context.Cities.First().Id, true, false, new List<ListingLineInput> { new("Stamp", 2) }, null, true);

            var create = await Assert.ThrowsAsync<MarketplaceException>(() => listings.CreateAsync(_seller.Id, input, Marketplace.TestImages.Many(1)));
            var archive = await _api.ClientFor(_seller).PostAsync($"api/Listings/{_hiddenListing.Id}/Archive", null);

            Assert.Equal("unknownItemType", create.Code);
            Assert.Equal(HttpStatusCode.NotFound, archive.StatusCode);
            Assert.Equal(ListingStatus.Active, Db.NewContext().Listings.Single(l => l.Id == _hiddenListing.Id).Status);
        }

        [Fact]
        public async Task NoNewChatOnHiddenListing()
        {
            Hide();

            var response = await _api.ClientFor(_buyer).PostAsync($"api/Listings/{_hiddenListing.Id}/Conversations", null);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.False(Db.NewContext().Conversations.Any(c => c.SubjectId == _hiddenListing.Id));
        }

        [Fact]
        public async Task OpenDealKeepsWorkingWhenTypeIsHidden()
        {
            var deal = Rows.Deal(_hiddenListing, _buyer, DealStatus.AwaitingShipment);
            deal.Method = DeliveryMethod.Shipping;
            Db.Context.Listings.Single(l => l.Id == _hiddenListing.Id).Status = ListingStatus.PendingShipment;
            Db.Context.SaveChanges();
            Hide();

            var ship = await _api.ClientFor(_seller).PostAsync($"api/Deals/{deal.Id}/Ship",
                new MultipartFormDataContent { { new StringContent("gls"), "carrier" }, { new StringContent("GLS123456"), "trackingNumber" } });
            var receive = await _api.ClientFor(_buyer).PostAsync($"api/Deals/{deal.Id}/ConfirmReceipt", new MultipartFormDataContent());
            var message = await _api.ClientFor(_buyer).PostAsJsonAsync($"api/Conversations/{deal.ConversationId}/Messages", new { kind = "text", body = "Arrived, thanks!" });
            var chat = await _api.ClientFor(_seller).GetAsync($"api/Conversations/{deal.ConversationId}");
            var review = await _api.ClientFor(_buyer).PostAsJsonAsync($"api/Deals/{deal.Id}/Reviews", new { stars = 5, comment = "Smooth deal." });

            Assert.True(ship.IsSuccessStatusCode, $"ship {(int)ship.StatusCode} {await ship.Content.ReadAsStringAsync()}");
            Assert.True(receive.IsSuccessStatusCode, $"receive {(int)receive.StatusCode} {await receive.Content.ReadAsStringAsync()}");
            Assert.True(message.IsSuccessStatusCode);
            Assert.Equal(HttpStatusCode.OK, chat.StatusCode);
            Assert.True(review.IsSuccessStatusCode, $"review {(int)review.StatusCode} {await review.Content.ReadAsStringAsync()}");
            Assert.Contains(deal.Id.ToString(), await Get(_buyer, "api/Deals/Mine"));
            Assert.Equal(DealStatus.Completed, Db.NewContext().Deals.Single(d => d.Id == deal.Id).Status);
        }

        [Fact]
        public async Task ActivityEntriesOfHiddenTypeAreUnavailable()
        {
            var collection = Db.AddCollection(_buyer, _hiddenType.Id, "Stamps");
            var item = Db.AddItem(collection);
            foreach (var (kind, itemId, collectionId, listingId) in new (string, Guid?, Guid?, Guid?)[]
            {
                ("reaction.liked", item.Id, null, null),
                ("follow.followed", null, collection.Id, null),
                ("listing.posted", null, null, _hiddenListing.Id),
            })
            {
                Db.Context.ActivityEvents.Add(new ActivityEvent
                {
                    Id = Guid.NewGuid(), UserId = _buyer.Id, Kind = kind, Category = Coffer.BusinessLogic.Activity.ActivityKinds.Category[kind],
                    OccurredAt = DateTime.UtcNow, ItemId = itemId, CollectionId = collectionId, ListingId = listingId,
                });
            }
            Db.Context.SaveChanges();
            Hide();

            var entries = JsonDocument.Parse(await Get(_buyer, "api/Activity")).RootElement.GetProperty("items").EnumerateArray().ToList();

            Assert.Equal(3, entries.Count);
            Assert.All(entries, e =>
            {
                var target = e.GetProperty("target");
                Assert.False(target.GetProperty("available").GetBoolean());
                Assert.Equal("", target.GetProperty("title").GetString());
            });
        }

        public void Dispose() => _api.Dispose();
    }
}
