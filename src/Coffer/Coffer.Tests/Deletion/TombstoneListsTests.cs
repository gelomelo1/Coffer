using System.Net;
using System.Text.Json;
using Coffer.Domain.Entities.Interfaces;
using Coffer.Domain.Marketplace;

namespace Coffer.Tests.Deletion
{
    /// <summary>
    /// Tombstones never show up in feeds, lists, pickers or the marketplace. (The trigram searches only run on
    /// PostgreSQL; they are checked against the dev database instead.)
    /// </summary>
    [Collection("api")]
    public class TombstoneListsTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private TestDb Db => _api.Db;
        private MarketRows Rows => new(Db);

        private void Tombstone(params object[] entities)
        {
            foreach (var e in entities) ((ITombstoned)e).DeletedAt = DateTime.UtcNow;
            Db.Context.SaveChanges();
        }

        private async Task<JsonElement> Get(HttpClient client, string url)
        {
            var response = await client.GetAsync(url);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        }

        private static async Task<string?> CodeOf(HttpResponseMessage response) =>
            JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.GetProperty("code").GetString();

        [Fact]
        public async Task FeedSkipsTombstonedItems()
        {
            var me = Db.AddUser("me");
            var collection = Db.AddCollection(Db.AddUser("anna"));
            var live = Db.AddItem(collection);
            Tombstone(Db.AddItem(collection));

            var page = await Get(_api.ClientFor(me), "api/Feed?page=1");

            Assert.Equal(1, page.GetProperty("total").GetInt32());
            Assert.Equal(live.Id, page.GetProperty("items")[0].GetProperty("item").GetProperty("id").GetGuid());
        }

        [Fact]
        public async Task FeedSkipsItemsOfDeletedUsers()
        {
            var me = Db.AddUser("me");
            var anna = Db.AddUser("anna");
            Db.AddItem(Db.AddCollection(anna));
            Tombstone(anna);

            var page = await Get(_api.ClientFor(me), "api/Feed?page=1");

            Assert.Equal(0, page.GetProperty("total").GetInt32());
        }

        [Fact]
        public async Task DeletedUsersOldNameIsFree()
        {
            var me = Db.AddUser("me");
            var anna = Db.AddUser("anna");
            Tombstone(anna);

            var response = await _api.ClientFor(me).GetAsync("api/Users/UserExists/anna");

            Assert.Equal("false", await response.Content.ReadAsStringAsync());
        }

        [Fact]
        public async Task GroupedCollectionsSkipTombstones()
        {
            var anna = Db.AddUser("anna");
            Db.AddCollection(anna);
            Tombstone(Db.AddCollection(anna));

            var page = await Get(_api.ClientFor(Db.AddUser("me")), $"api/Collections/Grouped?userId={anna.Id}&page=1");

            Assert.Equal(1, page.GetProperty("total").GetInt32());
            Assert.Equal(1, page.GetProperty("items").GetArrayLength());
        }

        [Fact]
        public async Task FollowsSkipTombstonedCollections()
        {
            var me = Db.AddUser("me");
            var anna = Db.AddUser("anna");
            Db.Follow(me, Db.AddCollection(anna));
            var gone = Db.AddCollection(anna);
            Db.Follow(me, gone);
            Tombstone(gone);

            var page = await Get(_api.ClientFor(me), "api/Feed/UserFollows?page=1");

            Assert.Equal(1, page.GetProperty("total").GetInt32());
            Assert.Equal(1, page.GetProperty("items").GetArrayLength());
        }

        [Fact]
        public async Task MentionPickerSkipsDeletedUsers()
        {
            var me = Db.AddUser("me");
            Db.AddUser("anna");
            Tombstone(Db.AddUser("andras"));

            var list = await Get(_api.ClientFor(me), "api/Comments/Mentionable?query=an");

            Assert.Equal(new[] { "anna" }, list.EnumerateArray().Select(m => m.GetProperty("name").GetString()).ToArray());
        }

        [Fact]
        public async Task CommentsOfTombstonedItemAre404()
        {
            var me = Db.AddUser("me");
            var item = Db.AddItem(Db.AddCollection(Db.AddUser("anna")));
            Rows.Comment(item, me, "Nice!");
            Tombstone(item);
            var client = _api.ClientFor(me);

            var list = await client.GetAsync($"api/Items/{item.Id}/Comments");
            var create = await client.PostAsync($"api/Items/{item.Id}/Comments",
                new StringContent("{\"body\":\"Still there?\"}", System.Text.Encoding.UTF8, "application/json"));

            Assert.Equal(HttpStatusCode.NotFound, list.StatusCode);
            Assert.Equal("itemDeleted", await CodeOf(list));
            Assert.Equal(HttpStatusCode.NotFound, create.StatusCode);
        }

        [Fact]
        public async Task ListingSearchSkipsTombstones()
        {
            var me = Db.AddUser("me");
            var anna = Db.AddUser("anna");
            var live = Rows.Listing(anna, title: "Live");
            Tombstone(Rows.Listing(anna, title: "Gone"));

            var page = await Get(_api.ClientFor(me), "api/Listings?page=1");

            Assert.Equal(1, page.GetProperty("total").GetInt32());
            Assert.Equal(live.Id, page.GetProperty("items")[0].GetProperty("id").GetGuid());
        }

        [Fact]
        public async Task TombstonedListingDetailsAre404()
        {
            var me = Db.AddUser("me");
            var listing = Rows.Listing(Db.AddUser("anna"));
            Tombstone(listing);

            var response = await _api.ClientFor(me).GetAsync($"api/Listings/{listing.Id}");

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Equal("listingDeleted", await CodeOf(response));
        }

        [Fact]
        public async Task TagStatsSkipTombstonedItems()
        {
            var me = Db.AddUser("me");
            var collection = Db.AddCollection(Db.AddUser("anna"));
            var live = Db.AddItem(collection);
            var gone = Db.AddItem(collection);
            Db.Context.ItemTags.Add(new Coffer.Domain.Entities.ItemTags { ItemId = live.Id, Tag = "silver" });
            Db.Context.ItemTags.Add(new Coffer.Domain.Entities.ItemTags { ItemId = gone.Id, Tag = "silver" });
            Db.Context.SaveChanges();
            Tombstone(gone);

            var stats = await Get(_api.ClientFor(me), "api/Feed/TagStats?tags=silver");

            Assert.Equal(1, stats.EnumerateArray().Single().GetProperty("itemCount").GetInt32());
        }

        public void Dispose() => _api.Dispose();
    }
}
