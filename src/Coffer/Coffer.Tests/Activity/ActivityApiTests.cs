using System.Net;
using System.Text.Json;
using Coffer.Domain.Entities;
using Coffer.Domain.Marketplace;
using Coffer.Tests.Deletion;
using Attribute = Coffer.Domain.Entities.Attribute;

namespace Coffer.Tests.Activity
{
    /// <summary>GET api/Activity: the owner's log, newest first, per category, with targets resolved at read time.</summary>
    [Collection("api")]
    public class ActivityApiTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private TestDb Db => _api.Db;
        private MarketRows Rows => new(Db);
        private static readonly DateTime T0 = new(2026, 11, 1, 12, 0, 0, DateTimeKind.Utc);

        private ActivityEvent Event(User user, string kind, DateTime at, Guid? itemId = null, Guid? collectionId = null, Guid? commentId = null,
            Guid? listingId = null, Guid? conversationId = null, Guid? dealId = null, Guid? reviewId = null, Guid? reportId = null,
            Guid? otherUserId = null, string details = "{}")
        {
            var e = new ActivityEvent
            {
                Id = Guid.NewGuid(), UserId = user.Id, Kind = kind, Category = Coffer.BusinessLogic.Activity.ActivityKinds.Category[kind],
                OccurredAt = at, ItemId = itemId, CollectionId = collectionId, CommentId = commentId, ListingId = listingId,
                ConversationId = conversationId, DealId = dealId, ReviewId = reviewId, ReportId = reportId, OtherUserId = otherUserId, Details = details,
            };
            Db.Context.ActivityEvents.Add(e);
            Db.Context.SaveChanges();
            return e;
        }

        private async Task<JsonElement> Get(User user, string url)
        {
            var response = await _api.ClientFor(user).GetAsync(url);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        }

        private static List<JsonElement> Items(JsonElement page) => page.GetProperty("items").EnumerateArray().ToList();

        private (CollectionProvided collection, ItemProvided item) BrandedItem(User owner, string brand)
        {
            var type = Db.AddCollectionType("Caps");
            var attribute = new Attribute { CollectionTypeId = type.Id, Name = "Brand", Primary = true, Required = true };
            Db.Context.Attributes.Add(attribute);
            Db.Context.SaveChanges();
            var collection = Db.AddCollection(owner, type.Id, "Beer caps");
            collection.Image = "cover.jpg";
            var item = Db.AddItem(collection, "cap.jpg");
            Db.Context.ItemAttributes.Add(new ItemAttribute { ItemId = item.Id, AttributeId = attribute.Id, ValueString = brand });
            Db.Context.SaveChanges();
            return (collection, item);
        }

        [Fact]
        public async Task ListIsNewestFirstAndPaged()
        {
            var me = Db.AddUser("me");
            var collection = Db.AddCollection(Db.AddUser("owner"));
            for (var i = 0; i < 25; i++) Event(me, "follow.followed", T0.AddMinutes(i), collectionId: collection.Id);

            var first = await Get(me, "api/Activity");
            var second = await Get(me, "api/Activity?page=2");

            Assert.Equal(25, first.GetProperty("total").GetInt32());
            Assert.Equal(20, Items(first).Count);
            Assert.Equal(5, Items(second).Count);
            Assert.Equal(T0.AddMinutes(24), Items(first)[0].GetProperty("occurredAt").GetDateTime().ToUniversalTime());
            Assert.Equal(T0, Items(second)[4].GetProperty("occurredAt").GetDateTime().ToUniversalTime());
        }

        [Fact]
        public async Task CategoryFilter()
        {
            var me = Db.AddUser("me");
            var item = Db.AddItem(Db.AddCollection(Db.AddUser("owner")));
            Event(me, "reaction.liked", T0, itemId: item.Id);
            Event(me, "follow.followed", T0.AddMinutes(1), collectionId: item.CollectionId);

            var likes = Items(await Get(me, "api/Activity?category=likes"));

            Assert.Equal(new[] { "reaction.liked" }, likes.Select(e => e.GetProperty("kind").GetString()));
            Assert.Equal("likes", likes[0].GetProperty("category").GetString());
        }

        [Fact]
        public async Task SummaryHasAllCategories()
        {
            var me = Db.AddUser("me");
            var item = Db.AddItem(Db.AddCollection(Db.AddUser("owner")));
            Event(me, "reaction.liked", T0, itemId: item.Id);
            Event(me, "reaction.rated", T0.AddHours(1), itemId: item.Id, details: "{\"to\":4}");

            var summary = (await Get(me, "api/Activity/Summary")).EnumerateArray().ToList();

            Assert.Equal(new[] { "likes", "comments", "collection", "follows", "marketplace", "trades", "reports" },
                summary.Select(s => s.GetProperty("category").GetString()));
            Assert.Equal(2, summary[0].GetProperty("count").GetInt32());
            Assert.Equal(T0.AddHours(1), summary[0].GetProperty("latestAt").GetDateTime().ToUniversalTime());
            Assert.Equal(0, summary[3].GetProperty("count").GetInt32());
            Assert.Equal(JsonValueKind.Null, summary[3].GetProperty("latestAt").ValueKind);
        }

        [Fact]
        public async Task TargetsResolveNamesAndImages()
        {
            var me = Db.AddUser("me");
            var seller = Db.AddUser("Sam Seller");
            var (collection, item) = BrandedItem(seller, "Heineken");
            var comment = Rows.Comment(item, me, "Lovely green cap");
            var listing = Rows.Listing(seller, title: "Rare caps");
            var deal = Rows.Deal(listing, me, DealStatus.Proposed);
            Event(me, "comment.posted", T0, itemId: item.Id, commentId: comment.Id);
            Event(me, "follow.followed", T0.AddMinutes(1), collectionId: collection.Id);
            Event(me, "deal.accepted", T0.AddMinutes(2), dealId: deal.Id, conversationId: deal.ConversationId, listingId: listing.Id, otherUserId: seller.Id);
            Event(me, "reaction.rated", T0.AddMinutes(3), itemId: item.Id, details: "{\"to\":4}");

            var entries = Items(await Get(me, "api/Activity"));
            JsonElement Target(string kind) => entries.Single(e => e.GetProperty("kind").GetString() == kind).GetProperty("target");

            var rated = entries.Single(e => e.GetProperty("kind").GetString() == "reaction.rated");
            Assert.Equal(4, rated.GetProperty("details").GetProperty("to").GetInt32());
            Assert.Equal("item", Target("reaction.rated").GetProperty("type").GetString());
            Assert.Equal("Heineken", Target("reaction.rated").GetProperty("title").GetString());
            Assert.Equal("cap.jpg", Target("reaction.rated").GetProperty("image").GetString());

            var c = Target("comment.posted");
            Assert.Equal("comment", c.GetProperty("type").GetString());
            Assert.Equal(comment.Id, c.GetProperty("commentId").GetGuid());
            Assert.Equal(item.Id, c.GetProperty("itemId").GetGuid());
            Assert.Equal("Heineken", c.GetProperty("title").GetString());
            Assert.Equal("Lovely green cap", c.GetProperty("excerpt").GetString());
            Assert.True(c.GetProperty("available").GetBoolean());

            var f = Target("follow.followed");
            Assert.Equal("collection", f.GetProperty("type").GetString());
            Assert.Equal("Beer caps", f.GetProperty("title").GetString());
            Assert.Equal("cover.jpg", f.GetProperty("image").GetString());

            var d = Target("deal.accepted");
            Assert.Equal("deal", d.GetProperty("type").GetString());
            Assert.Equal(deal.Id, d.GetProperty("dealId").GetGuid());
            Assert.Equal(deal.ConversationId, d.GetProperty("conversationId").GetGuid());
            Assert.Equal("Rare caps", d.GetProperty("title").GetString());
            Assert.Equal(listing.Images.First().FileName, d.GetProperty("image").GetString());
            Assert.Equal("Sam Seller", d.GetProperty("otherName").GetString());
        }

        [Fact]
        public async Task DeletedTargetsAreUnavailableAndNameless()
        {
            var me = Db.AddUser("me");
            var owner = Db.AddUser("owner");
            var (_, item) = BrandedItem(owner, "Heineken");
            var gone = Db.AddItem(Db.AddCollection(owner), "gone.jpg");
            gone.DeletedAt = T0;
            var comment = Rows.Comment(item, me, "Deleted later");
            comment.DeletedAt = T0;
            comment.Body = "";
            var leaver = Db.AddUser("Leaving Lou");
            var listing = Rows.Listing(leaver, title: "Old stamps");
            var deal = Rows.Deal(listing, me, DealStatus.Completed);
            Db.Context.SaveChanges();
            Event(me, "reaction.liked", T0, itemId: gone.Id);
            Event(me, "comment.deleted", T0.AddMinutes(1), itemId: item.Id, commentId: comment.Id);
            Event(me, "deal.receiptConfirmed", T0.AddMinutes(2), dealId: deal.Id, conversationId: deal.ConversationId, listingId: listing.Id, otherUserId: leaver.Id);
            Event(me, "follow.followed", T0.AddMinutes(3), collectionId: Guid.NewGuid()); // never existed
            leaver.DeletedAt = T0;
            leaver.Name = "Deleted user";
            Db.Context.SaveChanges();

            var entries = Items(await Get(me, "api/Activity"));

            Assert.Equal(4, entries.Count);
            Assert.All(entries, e =>
            {
                var t = e.GetProperty("target");
                Assert.False(t.GetProperty("available").GetBoolean());
                Assert.Equal("", t.GetProperty("title").GetString());
                Assert.Equal(JsonValueKind.Null, t.GetProperty("image").ValueKind);
                Assert.Equal(JsonValueKind.Null, t.GetProperty("excerpt").ValueKind);
            });
            var dealTarget = entries.Single(e => e.GetProperty("kind").GetString() == "deal.receiptConfirmed").GetProperty("target");
            Assert.Equal("", dealTarget.GetProperty("otherName").GetString());
        }

        [Fact]
        public async Task LogIsOwnerOnly()
        {
            var a = Db.AddUser("a");
            var b = Db.AddUser("b");
            var item = Db.AddItem(Db.AddCollection(Db.AddUser("owner")));
            Event(a, "reaction.liked", T0, itemId: item.Id);

            Assert.Equal(0, (await Get(b, "api/Activity")).GetProperty("total").GetInt32());
            Assert.Equal(0, (await Get(b, "api/Activity?category=likes")).GetProperty("total").GetInt32());
            Assert.All((await Get(b, "api/Activity/Summary")).EnumerateArray(), s => Assert.Equal(0, s.GetProperty("count").GetInt32()));
            Assert.Equal(HttpStatusCode.Unauthorized, (await _api.CreateClient().GetAsync("api/Activity")).StatusCode);
        }

        [Fact]
        public async Task UnknownCategoryIs400()
        {
            var me = Db.AddUser("me");

            var response = await _api.ClientFor(me).GetAsync("api/Activity?category=everything");

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("unknownActivityCategory", JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.GetProperty("code").GetString());
        }

        [Fact]
        public async Task AccountDeletionRemovesLog()
        {
            var me = Db.AddUser("me");
            var other = Db.AddUser("other");
            var item = Db.AddItem(Db.AddCollection(Db.AddUser("owner")));
            Event(me, "reaction.liked", T0, itemId: item.Id);
            Event(other, "reaction.liked", T0, itemId: item.Id);

            var delete = await _api.ClientFor(me).DeleteAsync("api/Account");

            Assert.True(delete.IsSuccessStatusCode, $"{delete.StatusCode}");
            using var fresh = Db.NewContext();
            Assert.False(fresh.ActivityEvents.Any(e => e.UserId == me.Id));
            Assert.True(fresh.ActivityEvents.Any(e => e.UserId == other.Id));
        }

        public void Dispose() => _api.Dispose();
    }
}
