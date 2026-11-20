using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Coffer.Tests.Deletion
{
    /// <summary>Tombstoned rows (deleted_at set) are invisible to the generic list / get / update endpoints.</summary>
    [Collection("api")]
    public class TombstoneHidingTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private TestDb Db => _api.Db;

        private void Tombstone(object entity)
        {
            ((Coffer.Domain.Entities.Interfaces.ITombstoned)entity).DeletedAt = DateTime.UtcNow;
            Db.Context.SaveChanges();
        }

        [Fact]
        public async Task GenericPageSkipsTombstonedItems()
        {
            var owner = Db.AddUser("owner");
            var collection = Db.AddCollection(owner);
            Db.AddItem(collection);
            var gone = Db.AddItem(collection);
            gone.Quantity = 7;
            Tombstone(gone);
            var filter = Uri.EscapeDataString($"CollectionId == \"{collection.Id}\"");

            var response = await _api.ClientFor(owner).GetAsync($"api/Items/Page?filter={filter}");
            var page = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(1, page.GetProperty("total").GetInt32());
            Assert.Equal(1, page.GetProperty("totalQuantity").GetInt32());
        }

        [Fact]
        public async Task GetByIdOfTombstonedItemIs404()
        {
            var owner = Db.AddUser("owner");
            var item = Db.AddItem(Db.AddCollection(owner));
            Tombstone(item);

            var response = await _api.ClientFor(owner).GetAsync($"api/Items/{item.Id}");

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task UpdateOfTombstonedCollectionIsRefusedLikeAMissingOne()
        {
            var owner = Db.AddUser("owner");
            var collection = Db.AddCollection(owner);
            Tombstone(collection);

            var response = await _api.ClientFor(owner).PutAsJsonAsync($"api/Collections/{collection.Id}",
                new { userId = owner.Id, collectionTypeId = collection.CollectionTypeId, name = "Renamed" });

            // The permission check answers 403 for a collection that doesn't exist; a tombstone is treated the same.
            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            using var fresh = Db.NewContext();
            Assert.NotEqual("Renamed", fresh.Collections.Single(c => c.Id == collection.Id).Name);
        }

        public void Dispose() => _api.Dispose();
    }
}
