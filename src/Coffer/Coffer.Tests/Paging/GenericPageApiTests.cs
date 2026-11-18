using System.Net;
using System.Text.Json;

namespace Coffer.Tests.Paging
{
    /// <summary>GET api/&lt;Controller&gt;/Page: one page of a filtered list plus the total count for that filter.</summary>
    [Collection("api")]
    public class GenericPageApiTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private TestDb Db => _api.Db;

        private static JsonElement Json(string body) => JsonDocument.Parse(body).RootElement;

        private async Task<JsonElement> Page(HttpClient client, string query)
        {
            var response = await client.GetAsync("api/Items/Page?" + query);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return Json(await response.Content.ReadAsStringAsync());
        }

        [Fact]
        public async Task Page_ReturnsTheRequestedSliceAndTheFilteredTotal()
        {
            var owner = Db.AddUser("owner");
            var mine = Db.AddCollection(owner);
            var other = Db.AddCollection(owner);
            for (var i = 0; i < 25; i++) Db.AddItem(mine);
            for (var i = 0; i < 3; i++) Db.AddItem(other);
            var client = _api.ClientFor(owner);
            var filter = Uri.EscapeDataString($"CollectionId == \"{mine.Id}\"");

            var first = await Page(client, $"filter={filter}&page=1&pageSize=20");
            var second = await Page(client, $"filter={filter}&page=2&pageSize=20");

            Assert.Equal(25, first.GetProperty("total").GetInt32());
            Assert.Equal(20, first.GetProperty("items").GetArrayLength());
            Assert.Equal(5, second.GetProperty("items").GetArrayLength());
            Assert.Equal(2, second.GetProperty("page").GetInt32());
            Assert.Equal(20, second.GetProperty("pageSize").GetInt32());
            var ids = first.GetProperty("items").EnumerateArray().Concat(second.GetProperty("items").EnumerateArray())
                .Select(i => i.GetProperty("id").GetString()).ToHashSet();
            Assert.Equal(25, ids.Count); // stable order: no item on two pages
        }

        [Fact]
        public async Task Page_SizeDefaultsTo20AndIsCappedAt50()
        {
            var owner = Db.AddUser("owner");
            var collection = Db.AddCollection(owner);
            for (var i = 0; i < 55; i++) Db.AddItem(collection);
            var client = _api.ClientFor(owner);

            Assert.Equal(20, (await Page(client, "page=1")).GetProperty("items").GetArrayLength());
            Assert.Equal(50, (await Page(client, "page=1&pageSize=500")).GetProperty("items").GetArrayLength());
            Assert.Equal(55, (await Page(client, "page=1&pageSize=500")).GetProperty("total").GetInt32());
        }

        [Fact]
        public async Task Page_RejectsFiltersOnBlockedFields()
        {
            var owner = Db.AddUser("owner");
            var response = await _api.ClientFor(owner).GetAsync("api/Users/Page?filter=" + Uri.EscapeDataString("Email != null"));
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        public void Dispose() => _api.Dispose();
    }
}
