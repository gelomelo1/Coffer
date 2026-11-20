using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Coffer.Domain.Entities;
using Attribute = Coffer.Domain.Entities.Attribute;

namespace Coffer.Tests.Pending
{
    /// <summary>The waiting-for-review list: read it (matches computed fresh), add a cap, skip & delete it.</summary>
    [Collection("api")]
    public class PendingItemsApiTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private TestDb Db => _api.Db;

        private User _owner = null!;
        private CollectionProvided _collection = null!;
        private Attribute _brand = null!;

        private void Setup()
        {
            _owner = Db.AddUser("owner");
            var type = Db.AddCollectionType("Caps");
            _brand = new Attribute { CollectionTypeId = type.Id, Name = "Brand", Primary = true, Required = true };
            Db.Context.Attributes.Add(_brand);
            Db.Context.Attributes.Add(new Attribute { CollectionTypeId = type.Id, Name = "Notes", Primary = false, Required = false });
            Db.Context.SaveChanges();
            _collection = Db.AddCollection(_owner, type.Id, "Caps");
        }

        private PendingItem AddPending(int quantity = 1, DateTime? createdAt = null, CollectionProvided? collection = null, User? owner = null)
        {
            var id = Guid.NewGuid();
            File.WriteAllBytes(PendingPath(id, "jpg"), new byte[] { 0xFF, 0xD8, 0xFF });
            File.WriteAllBytes(PendingPath(id, "npy"), new byte[] { 1, 2, 3 });
            var row = new PendingItem
            {
                Id = id, UserId = (owner ?? _owner).Id, CollectionId = (collection ?? _collection).Id, Quantity = quantity,
                Image = $"{id}.jpg", CreatedAt = createdAt ?? DateTime.UtcNow,
            };
            Db.Context.PendingItems.Add(row);
            Db.Context.SaveChanges();
            return row;
        }

        private static string PendingPath(Guid id, string ext) => Path.Combine(TestEnvironment.Pending, $"{id}.{ext}");

        /// <summary>Fakes the AI service per path: pending_similars answers with the given matches, the rest with ok / the given status.</summary>
        private void FakeAi(Dictionary<Guid, Guid>? matches = null, HttpStatusCode similarsStatus = HttpStatusCode.OK, HttpStatusCode saveStatus = HttpStatusCode.OK)
        {
            _api.Python.Responder = request =>
            {
                var path = request.RequestUri!.AbsolutePath;
                if (path.StartsWith("/pending_similars/"))
                {
                    if (similarsStatus != HttpStatusCode.OK) return (similarsStatus, "{\"status\":\"error\"}");
                    var ids = JsonDocument.Parse(request.Content!.ReadAsStringAsync().Result).RootElement.GetProperty("ids").EnumerateArray().Select(e => e.GetGuid());
                    var response = ids.Select(id => matches != null && matches.TryGetValue(id, out var m)
                        ? new { id, state = "found", similars = new[] { m } }
                        : new { id, state = "not found", similars = Array.Empty<Guid>() });
                    return (HttpStatusCode.OK, JsonSerializer.Serialize(new { status = "ok", response }));
                }
                if (path.StartsWith("/save_pending_embedding/"))
                    return saveStatus == HttpStatusCode.OK ? (HttpStatusCode.OK, "{\"status\":\"ok\"}") : (saveStatus, "{\"status\":\"error\"}");
                return (HttpStatusCode.OK, "{\"status\":\"ok\"}");
            };
        }

        private object NewItemBody(string brand, int quantity) => new
        {
            item = new
            {
                collectionId = _collection.Id, quantity, image = "",
                itemAttributes = new[] { new { attributeId = _brand.Id, valueString = brand } },
                itemTags = Array.Empty<object>(),
            },
            quantity,
        };

        private static async Task<JsonElement> Json(HttpResponseMessage response) => JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

        [Fact]
        public async Task ListIsNewestFirstAndRematched()
        {
            Setup();
            var match = Db.AddItem(_collection);
            var old = AddPending(createdAt: DateTime.UtcNow.AddDays(-2));
            var mid = AddPending(createdAt: DateTime.UtcNow.AddDays(-1));
            var newest = AddPending(createdAt: DateTime.UtcNow);
            FakeAi(new Dictionary<Guid, Guid> { [mid.Id] = match.Id });

            var page = await Json(await _api.ClientFor(_owner).GetAsync($"api/Collections/{_collection.Id}/Pending?page=1"));

            Assert.Equal(3, page.GetProperty("total").GetInt32());
            var items = page.GetProperty("items").EnumerateArray().ToList();
            Assert.Equal(new[] { newest.Id, mid.Id, old.Id }, items.Select(i => i.GetProperty("id").GetGuid()).ToArray());
            Assert.Equal("found", items[1].GetProperty("state").GetString());
            Assert.Equal(match.Id, items[1].GetProperty("similars")[0].GetProperty("id").GetGuid());
            Assert.Equal("not found", items[0].GetProperty("state").GetString());
        }

        [Fact]
        public async Task ListSurvivesAiFailure()
        {
            Setup();
            AddPending();
            FakeAi(similarsStatus: HttpStatusCode.InternalServerError);

            var response = await _api.ClientFor(_owner).GetAsync($"api/Collections/{_collection.Id}/Pending?page=1");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var item = (await Json(response)).GetProperty("items")[0];
            Assert.Equal("not found", item.GetProperty("state").GetString());
            Assert.Equal(0, item.GetProperty("similars").GetArrayLength());
        }

        [Fact]
        public async Task SummaryCountsPerCollection()
        {
            Setup();
            var second = Db.AddCollection(_owner, _collection.CollectionTypeId, "Second");
            AddPending();
            AddPending();
            AddPending(collection: second);
            Db.AddCollection(_owner, _collection.CollectionTypeId, "Empty");

            var summary = (await Json(await _api.ClientFor(_owner).GetAsync("api/Pending/Summary"))).EnumerateArray()
                .ToDictionary(s => s.GetProperty("collectionId").GetGuid(), s => s.GetProperty("count").GetInt32());

            Assert.Equal(2, summary.Count);
            Assert.Equal(2, summary[_collection.Id]);
            Assert.Equal(1, summary[second.Id]);
        }

        [Fact]
        public async Task AddToMatchIncreasesQuantityAndClearsPending()
        {
            Setup();
            var match = Db.AddItem(_collection);
            match.Quantity = 2;
            Db.Context.SaveChanges();
            var pending = AddPending(quantity: 1);
            FakeAi();

            var response = await _api.ClientFor(_owner).PostAsJsonAsync($"api/Pending/{pending.Id}/Add", new { matchItemId = match.Id, quantity = 3 });

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            using var fresh = Db.NewContext();
            Assert.Equal(5, fresh.Items.Single(i => i.Id == match.Id).Quantity);
            Assert.False(fresh.PendingItems.Any(p => p.Id == pending.Id));
            Assert.False(File.Exists(PendingPath(pending.Id, "jpg")));
            Assert.False(File.Exists(PendingPath(pending.Id, "npy")));
        }

        [Fact]
        public async Task AddNewCreatesItemWithImageAndEmbedding()
        {
            Setup();
            var pending = AddPending(quantity: 2);
            FakeAi();

            var response = await _api.ClientFor(_owner).PostAsJsonAsync($"api/Pending/{pending.Id}/Add", NewItemBody("Heineken", 2));

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var itemId = (await Json(response)).GetProperty("id").GetGuid();
            using var fresh = Db.NewContext();
            var item = fresh.Items.Single(i => i.Id == itemId);
            Assert.Equal(2, item.Quantity);
            Assert.Equal(_collection.Id, item.CollectionId);
            Assert.True(File.Exists(Path.Combine(TestEnvironment.ItemImages, item.Image)));
            Assert.Equal("Heineken", fresh.ItemAttributes.Single(a => a.ItemId == itemId && a.AttributeId == _brand.Id).ValueString);
            Assert.Contains(_api.Python.Calls, c => c.Path == $"/save_pending_embedding/{_collection.Id}");
            Assert.False(fresh.PendingItems.Any(p => p.Id == pending.Id));
        }

        [Fact]
        public async Task AddNewWithoutRequiredAttributeIs400()
        {
            Setup();
            var pending = AddPending();
            FakeAi();

            var response = await _api.ClientFor(_owner).PostAsJsonAsync($"api/Pending/{pending.Id}/Add", NewItemBody("  ", 1));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("requiredAttributeMissing", (await Json(response)).GetProperty("code").GetString());
            using var fresh = Db.NewContext();
            Assert.False(fresh.Items.Any(i => i.CollectionId == _collection.Id));
            Assert.True(fresh.PendingItems.Any(p => p.Id == pending.Id));
        }

        [Fact]
        public async Task AddNewWhenAiFailsKeepsPending()
        {
            Setup();
            var pending = AddPending();
            FakeAi(saveStatus: HttpStatusCode.InternalServerError);
            var imagesBefore = Directory.GetFiles(TestEnvironment.ItemImages).Length;

            var response = await _api.ClientFor(_owner).PostAsJsonAsync($"api/Pending/{pending.Id}/Add", NewItemBody("Heineken", 1));

            Assert.False(response.IsSuccessStatusCode);
            using var fresh = Db.NewContext();
            Assert.False(fresh.Items.Any(i => i.CollectionId == _collection.Id));
            Assert.Equal(imagesBefore, Directory.GetFiles(TestEnvironment.ItemImages).Length);
            Assert.True(fresh.PendingItems.Any(p => p.Id == pending.Id));
            Assert.True(File.Exists(PendingPath(pending.Id, "jpg")));
        }

        [Fact]
        public async Task AddToDeletedMatchKeepsPending()
        {
            Setup();
            var match = Db.AddItem(_collection);
            match.DeletedAt = DateTime.UtcNow;
            Db.Context.SaveChanges();
            var pending = AddPending();
            FakeAi();

            var response = await _api.ClientFor(_owner).PostAsJsonAsync($"api/Pending/{pending.Id}/Add", new { matchItemId = match.Id, quantity = 1 });

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Equal("matchItemNotFound", (await Json(response)).GetProperty("code").GetString());
            using var fresh = Db.NewContext();
            Assert.True(fresh.PendingItems.Any(p => p.Id == pending.Id));
        }

        [Fact]
        public async Task AddTwiceCreatesOneItem()
        {
            Setup();
            var pending = AddPending();
            FakeAi();
            var client = _api.ClientFor(_owner);

            var first = await client.PostAsJsonAsync($"api/Pending/{pending.Id}/Add", NewItemBody("Heineken", 1));
            var second = await client.PostAsJsonAsync($"api/Pending/{pending.Id}/Add", NewItemBody("Heineken", 1));

            Assert.Equal(HttpStatusCode.OK, first.StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, second.StatusCode);
            Assert.Equal("pendingItemNotFound", (await Json(second)).GetProperty("code").GetString());
            using var fresh = Db.NewContext();
            Assert.Single(fresh.Items.Where(i => i.CollectionId == _collection.Id));
        }

        [Fact]
        public async Task DeleteRemovesRowAndFilesAndIsIdempotent()
        {
            Setup();
            var pending = AddPending();
            var client = _api.ClientFor(_owner);

            var first = await client.DeleteAsync($"api/Pending/{pending.Id}");
            var second = await client.DeleteAsync($"api/Pending/{pending.Id}");

            Assert.Equal(HttpStatusCode.NoContent, first.StatusCode);
            Assert.Equal(HttpStatusCode.NoContent, second.StatusCode);
            using var fresh = Db.NewContext();
            Assert.False(fresh.PendingItems.Any(p => p.Id == pending.Id));
            Assert.False(File.Exists(PendingPath(pending.Id, "jpg")));
            Assert.False(File.Exists(PendingPath(pending.Id, "npy")));
        }

        [Fact]
        public async Task OtherUsersPendingIs404()
        {
            Setup();
            var pending = AddPending();
            var stranger = _api.ClientFor(Db.AddUser("stranger"));
            FakeAi();

            var list = await stranger.GetAsync($"api/Collections/{_collection.Id}/Pending?page=1");
            var image = await stranger.GetAsync($"api/Pending/Image/{pending.Id}");
            var add = await stranger.PostAsJsonAsync($"api/Pending/{pending.Id}/Add", new { matchItemId = Guid.NewGuid(), quantity = 1 });
            var delete = await stranger.DeleteAsync($"api/Pending/{pending.Id}");

            Assert.Equal(HttpStatusCode.NotFound, list.StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, image.StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, add.StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, delete.StatusCode);
            using var fresh = Db.NewContext();
            Assert.True(fresh.PendingItems.Any(p => p.Id == pending.Id));
            Assert.True(File.Exists(PendingPath(pending.Id, "jpg")));
        }

        public void Dispose() => _api.Dispose();
    }
}
