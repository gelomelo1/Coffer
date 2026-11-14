using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Coffer.Domain.Entities;
using Coffer.Domain.Marketplace;

namespace Coffer.Tests.Marketplace
{
    [Collection("api")]
    public class DealApiTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private TestDb Db => _api.Db;

        private static Guid IdOf(string json) => JsonDocument.Parse(json).RootElement.GetProperty("id").GetGuid();

        private async Task<(User seller, User buyer, Guid dealId)> ShippingDealAwaitingShipment()
        {
            var seller = Db.AddUser("seller");
            var buyer = Db.AddUser("buyer");
            var type = new CollectionTypeProvided("Stamps", "d", "#19283f", "stamp");
            var city = new City { ExternalId = 1, Name = "Budapest", CountryCode = "HU", Latitude = 47.5, Longitude = 19.04 };
            Db.Context.CollectionTypes.Add(type);
            Db.Context.Cities.Add(city);
            Db.Context.SaveChanges();
            var listing = new Listing
            {
                OwnerId = seller.Id, Kind = ListingKind.Sell, CollectionTypeId = type.Id, Title = "Album", PriceCents = 1000,
                Condition = ListingCondition.Good, CityId = city.Id, AllowsShipping = true, Status = ListingStatus.Active,
                CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
            };
            listing.Lines.Add(new ListingLine { Name = "Stamp", Quantity = 1 });
            Db.Context.Listings.Add(listing);
            Db.Context.SaveChanges();

            var conversation = await _api.ClientFor(buyer).PostAsync($"api/Listings/{listing.Id}/Conversations", null);
            var conversationId = IdOf(await conversation.Content.ReadAsStringAsync());
            var proposed = await _api.ClientFor(seller).PostAsJsonAsync("api/Deals", new { conversationId, method = "shipping" });
            Assert.Equal(HttpStatusCode.OK, proposed.StatusCode);
            var dealId = IdOf(await proposed.Content.ReadAsStringAsync());
            Assert.Equal(HttpStatusCode.OK, (await _api.ClientFor(buyer).PostAsync($"api/Deals/{dealId}/Accept", null)).StatusCode);
            return (seller, buyer, dealId);
        }

        [Fact]
        public async Task Stranger_CannotReadDeal()
        {
            var (_, _, dealId) = await ShippingDealAwaitingShipment();
            var response = await _api.ClientFor(Db.AddUser("stranger")).GetAsync($"api/Deals/{dealId}");
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task Ship_Multipart_PhotoStored_AndOnlyPartiesSeeIt()
        {
            var (seller, buyer, dealId) = await ShippingDealAwaitingShipment();
            var photo = new ByteArrayContent(TestImages.Jpeg);
            photo.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
            var form = new MultipartFormDataContent
            {
                { new StringContent("gls"), "carrier" },
                { new StringContent("GLS998877"), "trackingNumber" },
                { photo, "photo", "parcel.jpg" },
            };

            var response = await _api.ClientFor(seller).PostAsync($"api/Deals/{dealId}/Ship", form);
            var json = await response.Content.ReadAsStringAsync();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Contains("\"status\":\"shipped\"", json);
            var fileName = JsonDocument.Parse(json).RootElement.GetProperty("shipmentPhoto").GetString()!;
            Assert.Equal(HttpStatusCode.OK, (await _api.ClientFor(buyer).GetAsync($"api/Deals/Image/{fileName}")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await _api.ClientFor(Db.AddUser("stranger")).GetAsync($"api/Deals/Image/{fileName}")).StatusCode);
        }

        [Fact]
        public async Task WrongActor_403_WrongState_409()
        {
            var (seller, buyer, dealId) = await ShippingDealAwaitingShipment();
            Assert.Equal(HttpStatusCode.Forbidden, (await _api.ClientFor(buyer).PostAsync($"api/Deals/{dealId}/Ship",
                new MultipartFormDataContent { { new StringContent("gls"), "carrier" }, { new StringContent("GLS1234"), "trackingNumber" } })).StatusCode);
            Assert.Equal(HttpStatusCode.Conflict, (await _api.ClientFor(buyer).PostAsync($"api/Deals/{dealId}/ConfirmReceipt",
                new MultipartFormDataContent())).StatusCode);
        }

        [Fact]
        public async Task Carriers_Listed()
        {
            var json = await _api.ClientFor(Db.AddUser("u")).GetStringAsync("api/Deals/Carriers");
            Assert.Contains("magyar_posta", json);
        }

        public void Dispose() => _api.Dispose();
    }
}
