using System.Net;
using System.Text.Json;

namespace Coffer.Tests.Paging
{
    /// <summary>Home feed, followed collections and a user's collections come in pages of 20 with totals.</summary>
    [Collection("api")]
    public class FeedPagingApiTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private TestDb Db => _api.Db;

        private async Task<JsonElement> Get(HttpClient client, string url)
        {
            var response = await client.GetAsync(url);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        }

        private static List<string> Ids(JsonElement page, Func<JsonElement, JsonElement> pick) =>
            page.GetProperty("items").EnumerateArray().Select(e => pick(e).GetProperty("id").GetString()!).ToList();

        [Fact]
        public async Task Feed_PagesOtherPeoplesRecentItems()
        {
            var me = Db.AddUser("me");
            var collection = Db.AddCollection(Db.AddUser("anna"));
            for (var i = 0; i < 25; i++) Db.AddItem(collection);
            Db.AddItem(Db.AddCollection(me)); // my own items are not in my feed
            var client = _api.ClientFor(me);

            var first = await Get(client, "api/Feed?page=1&pageSize=20");
            var second = await Get(client, "api/Feed?page=2&pageSize=20");

            Assert.Equal(25, first.GetProperty("total").GetInt32());
            Assert.Equal(5, second.GetProperty("items").GetArrayLength());
            Assert.Equal("anna", second.GetProperty("items")[0].GetProperty("user").GetProperty("name").GetString());
            Assert.Equal(25, Ids(first, e => e.GetProperty("item")).Concat(Ids(second, e => e.GetProperty("item"))).Distinct().Count());
        }

        [Fact]
        public async Task UserFollows_AreOrderedByCollectionTypeWithCountsPerType()
        {
            var me = Db.AddUser("me");
            var anna = Db.AddUser("anna");
            var coins = Db.AddCollectionType("Coins");
            var stamps = Db.AddCollectionType("Stamps");
            for (var i = 0; i < 3; i++) Db.Follow(me, Db.AddCollection(anna, stamps.Id, $"s{i}"));
            for (var i = 0; i < 2; i++) Db.Follow(me, Db.AddCollection(anna, coins.Id, $"c{i}"));

            var page = await Get(_api.ClientFor(me), "api/Feed/UserFollows?page=1&pageSize=20");

            Assert.Equal(5, page.GetProperty("total").GetInt32());
            var types = page.GetProperty("items").EnumerateArray().Select(e => e.GetProperty("collection").GetProperty("collectionTypeId").GetInt32()).ToList();
            Assert.Equal(new[] { coins.Id, coins.Id, stamps.Id, stamps.Id, stamps.Id }, types);
            var counts = page.GetProperty("groupCounts");
            Assert.Equal(2, counts.GetProperty(coins.Id.ToString()).GetInt32());
            Assert.Equal(3, counts.GetProperty(stamps.Id.ToString()).GetInt32());
        }

        [Fact]
        public async Task GroupedCollections_SortEachTypeAsAskedAndCountPerType()
        {
            var anna = Db.AddUser("anna");
            var coins = Db.AddCollectionType("Coins");
            var stamps = Db.AddCollectionType("Stamps");
            Db.AddCollection(anna, stamps.Id, "Zebra stamps");
            Db.AddCollection(anna, stamps.Id, "Alpine stamps");
            Db.AddCollection(anna, coins.Id, "Old coins");
            Db.AddCollection(Db.AddUser("bob"), coins.Id, "Not anna's");

            var page = await Get(_api.ClientFor(anna), $"api/Collections/Grouped?userId={anna.Id}&byName={stamps.Id}&page=1&pageSize=20");

            Assert.Equal(3, page.GetProperty("total").GetInt32());
            var names = page.GetProperty("items").EnumerateArray().Select(e => e.GetProperty("name").GetString()).ToList();
            Assert.Equal(new[] { "Old coins", "Alpine stamps", "Zebra stamps" }, names);
            Assert.Equal(2, page.GetProperty("groupCounts").GetProperty(stamps.Id.ToString()).GetInt32());
        }

        public void Dispose() => _api.Dispose();
    }
}
