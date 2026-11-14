using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Coffer.Domain.Entities;
using Coffer.Domain.Marketplace;

namespace Coffer.Tests.Marketplace
{
    [Collection("api")]
    public class ConversationApiTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private TestDb Db => _api.Db;

        private Listing SeedListing(User owner)
        {
            var type = new CollectionTypeProvided("Stamps", "d", "#19283f", "stamp");
            var city = new City { ExternalId = 1, Name = "Budapest", CountryCode = "HU", Latitude = 47.5, Longitude = 19.04 };
            Db.Context.CollectionTypes.Add(type);
            Db.Context.Cities.Add(city);
            Db.Context.SaveChanges();
            var listing = new Listing
            {
                OwnerId = owner.Id, Kind = ListingKind.Sell, CollectionTypeId = type.Id, Title = "Album", PriceCents = 1000,
                Condition = ListingCondition.Good, CityId = city.Id, AllowsLocalPickup = true, Status = ListingStatus.Active,
                CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
            };
            listing.Lines.Add(new ListingLine { Name = "Stamp", Quantity = 1 });
            Db.Context.Listings.Add(listing);
            Db.Context.SaveChanges();
            return listing;
        }

        [Fact]
        public async Task Buyer_OpensChat_SendsOffer_SellerAccepts_StrangerLockedOut()
        {
            var seller = Db.AddUser("seller");
            var buyer = Db.AddUser("buyer");
            var listing = SeedListing(seller);

            var opened = await _api.ClientFor(buyer).PostAsync($"api/Listings/{listing.Id}/Conversations", null);
            Assert.Equal(HttpStatusCode.OK, opened.StatusCode);
            var conversationId = JsonDocument.Parse(await opened.Content.ReadAsStringAsync()).RootElement.GetProperty("id").GetGuid();

            var offer = await _api.ClientFor(buyer).PostAsJsonAsync($"api/Conversations/{conversationId}/Messages", new { kind = "price_offer", amountCents = 900 });
            Assert.Equal(HttpStatusCode.OK, offer.StatusCode);
            var offerJson = await offer.Content.ReadAsStringAsync();
            Assert.Contains("\"status\":\"pending\"", offerJson);
            var offerId = JsonDocument.Parse(offerJson).RootElement.GetProperty("id").GetGuid();

            var accept = await _api.ClientFor(seller).PostAsJsonAsync($"api/Conversations/{conversationId}/Messages/{offerId}/Respond", new { action = "accept" });
            Assert.Equal(HttpStatusCode.OK, accept.StatusCode);

            var stranger = _api.ClientFor(Db.AddUser("stranger"));
            Assert.Equal(HttpStatusCode.NotFound, (await stranger.GetAsync($"api/Conversations/{conversationId}/Messages")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await stranger.PostAsJsonAsync($"api/Conversations/{conversationId}/Messages", new { kind = "text", body = "hi" })).StatusCode);

            var inbox = await _api.ClientFor(seller).GetStringAsync("api/Conversations");
            Assert.Contains(conversationId.ToString(), inbox);
        }

        [Fact]
        public async Task Owner_CannotOpenChatOnOwnListing_403()
        {
            var seller = Db.AddUser("seller");
            var listing = SeedListing(seller);
            var response = await _api.ClientFor(seller).PostAsync($"api/Listings/{listing.Id}/Conversations", null);
            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        public void Dispose() => _api.Dispose();
    }
}
