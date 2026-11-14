using System.Net;
using System.Net.Http.Json;
using Coffer.Domain.Entities;
using Coffer.Domain.Marketplace;

namespace Coffer.Tests.Marketplace
{
    [Collection("api")]
    public class ReviewApiTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private TestDb Db => _api.Db;

        private Deal CompletedDeal(User seller, User buyer)
        {
            var type = new CollectionTypeProvided("Stamps", "d", "#19283f", "stamp");
            var city = new City { ExternalId = 1, Name = "Budapest", CountryCode = "HU", Latitude = 47.5, Longitude = 19.04 };
            Db.Context.CollectionTypes.Add(type);
            Db.Context.Cities.Add(city);
            Db.Context.SaveChanges();
            var listing = new Listing
            {
                OwnerId = seller.Id, Kind = ListingKind.Sell, CollectionTypeId = type.Id, Title = "Album", PriceCents = 1000,
                Condition = ListingCondition.Good, CityId = city.Id, AllowsLocalPickup = true, Status = ListingStatus.Sold,
                CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
            };
            listing.Lines.Add(new ListingLine { Name = "Stamp", Quantity = 1 });
            var conversation = new Conversation { SubjectType = "listing", SubjectId = listing.Id, CreatedAt = DateTime.UtcNow, LastMessageAt = DateTime.UtcNow };
            Db.Context.Listings.Add(listing);
            Db.Context.Conversations.Add(conversation);
            Db.Context.SaveChanges();
            conversation.SubjectId = listing.Id;
            var deal = new Deal
            {
                ListingId = listing.Id, ConversationId = conversation.Id, SellerId = seller.Id, BuyerId = buyer.Id,
                Method = DeliveryMethod.LocalPickup, Status = DealStatus.Completed, CompletedAt = DateTime.UtcNow,
                ReviewDeadline = DateTime.UtcNow.AddDays(14), CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
            };
            Db.Context.Deals.Add(deal);
            Db.Context.SaveChanges();
            return deal;
        }

        [Fact]
        public async Task LowRatingWithSnakeCaseTag_Accepted_AndHiddenFromSeller()
        {
            var seller = Db.AddUser("seller");
            var buyer = Db.AddUser("buyer");
            var deal = CompletedDeal(seller, buyer);

            var tooShort = await _api.ClientFor(buyer).PostAsJsonAsync($"api/Deals/{deal.Id}/Reviews", new { stars = 1, reasonTag = "late_to_meetup", comment = "late" });
            Assert.Equal(HttpStatusCode.BadRequest, tooShort.StatusCode);

            var ok = await _api.ClientFor(buyer).PostAsJsonAsync($"api/Deals/{deal.Id}/Reviews",
                new { stars = 2, reasonTag = "late_to_meetup", comment = "Came 45 minutes late without a message." });
            Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
            Assert.Contains("\"reasonTag\":\"late_to_meetup\"", await ok.Content.ReadAsStringAsync());

            var sellerView = await _api.ClientFor(seller).GetStringAsync($"api/Deals/{deal.Id}/Reviews");
            Assert.Contains("\"theirs\":null", sellerView);
            Assert.Contains("\"theyHaveSubmitted\":true", sellerView);

            var publicList = await _api.ClientFor(Db.AddUser("viewer")).GetStringAsync($"api/Users/{seller.Id}/MarketReviews");
            Assert.Equal("[]", publicList);
            var reputation = await _api.ClientFor(Db.AddUser("viewer2")).GetStringAsync($"api/Users/{seller.Id}/Reputation");
            Assert.Contains("\"completedDeals\":1", reputation);
        }

        [Fact]
        public async Task Outsider_CannotReview_403()
        {
            var deal = CompletedDeal(Db.AddUser("seller"), Db.AddUser("buyer"));
            var response = await _api.ClientFor(Db.AddUser("outsider")).PostAsJsonAsync($"api/Deals/{deal.Id}/Reviews", new { stars = 5 });
            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        public void Dispose() => _api.Dispose();
    }
}
