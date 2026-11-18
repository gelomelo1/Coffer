using System.Net;
using System.Text.Json;
using Coffer.Domain.Entities;
using Coffer.Domain.Marketplace;

namespace Coffer.Tests.Paging
{
    /// <summary>The marketplace list endpoints answer in the paged shape { items, page, pageSize, total }.</summary>
    [Collection("api")]
    public class MarketPagingApiTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private TestDb Db => _api.Db;

        private void SeedListings(User owner, int count)
        {
            var type = new CollectionTypeProvided("Stamps", "d", "#19283f", "stamp");
            var city = new City { ExternalId = 1, Name = "Budapest", CountryCode = "HU", Latitude = 47.5, Longitude = 19.04 };
            Db.Context.CollectionTypes.Add(type);
            Db.Context.Cities.Add(city);
            Db.Context.SaveChanges();
            for (var i = 0; i < count; i++)
            {
                var listing = new Listing
                {
                    OwnerId = owner.Id, Kind = ListingKind.Sell, CollectionTypeId = type.Id, Title = $"Album {i}", PriceCents = 1000,
                    Condition = ListingCondition.Good, CityId = city.Id, AllowsLocalPickup = true, Status = ListingStatus.Active,
                    CreatedAt = DateTime.UtcNow.AddMinutes(-i), UpdatedAt = DateTime.UtcNow,
                };
                listing.Lines.Add(new ListingLine { Name = "Stamp", Quantity = 1 });
                Db.Context.Listings.Add(listing);
            }
            Db.Context.SaveChanges();
        }

        [Fact]
        public async Task ListingSearch_ReturnsAPageWithTheTotal()
        {
            SeedListings(Db.AddUser("seller"), 5);
            var response = await _api.ClientFor(Db.AddUser("buyer")).GetAsync("api/Listings?page=2&pageSize=3");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var page = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
            Assert.Equal(JsonValueKind.Object, page.ValueKind);
            Assert.Equal(5, page.GetProperty("total").GetInt32());
            Assert.Equal(2, page.GetProperty("items").GetArrayLength());
        }

        [Theory]
        [InlineData("api/Listings/Mine")]
        [InlineData("api/Conversations")]
        [InlineData("api/Deals/Mine")]
        [InlineData("api/Reports/Mine")]
        [InlineData("api/Moderation/AgainstMe")]
        public async Task MarketLists_AnswerInThePagedShape(string url)
        {
            var response = await _api.ClientFor(Db.AddUser("me")).GetAsync(url);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var page = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
            Assert.Equal(0, page.GetProperty("total").GetInt32());
            Assert.Equal(20, page.GetProperty("pageSize").GetInt32());
        }

        public void Dispose() => _api.Dispose();
    }
}
