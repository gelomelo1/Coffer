using System.Net;
using Coffer.Domain.Entities;

namespace Coffer.Tests.Pending
{
    /// <summary>Waiting caps are the owner's own data: they go, files included, with their collection or account.</summary>
    [Collection("api")]
    public class PendingCleanupTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private TestDb Db => _api.Db;

        private static string PendingPath(Guid id, string ext) => Path.Combine(TestEnvironment.Pending, $"{id}.{ext}");

        private PendingItem AddPending(User owner, CollectionProvided collection)
        {
            var id = Guid.NewGuid();
            File.WriteAllBytes(PendingPath(id, "jpg"), new byte[] { 1 });
            File.WriteAllBytes(PendingPath(id, "npy"), new byte[] { 1 });
            var row = new PendingItem { Id = id, UserId = owner.Id, CollectionId = collection.Id, Quantity = 1, Image = $"{id}.jpg", CreatedAt = DateTime.UtcNow };
            Db.Context.PendingItems.Add(row);
            Db.Context.SaveChanges();
            return row;
        }

        private void AssertGone(params PendingItem[] rows)
        {
            using var fresh = Db.NewContext();
            foreach (var row in rows)
            {
                Assert.False(fresh.PendingItems.Any(p => p.Id == row.Id));
                Assert.False(File.Exists(PendingPath(row.Id, "jpg")));
                Assert.False(File.Exists(PendingPath(row.Id, "npy")));
            }
        }

        [Fact]
        public async Task CollectionDeleteRemovesItsPendingItemsAndFiles()
        {
            var owner = Db.AddUser("owner");
            var collection = Db.AddCollection(owner);
            var other = Db.AddCollection(owner);
            var a = AddPending(owner, collection);
            var b = AddPending(owner, collection);
            var kept = AddPending(owner, other);

            var response = await _api.ClientFor(owner).DeleteAsync($"api/Collections/{collection.Id}");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            AssertGone(a, b);
            using var fresh = Db.NewContext();
            Assert.True(fresh.PendingItems.Any(p => p.Id == kept.Id));
            Assert.True(File.Exists(PendingPath(kept.Id, "jpg")));
        }

        [Fact]
        public async Task AccountDeleteRemovesPendingItemsAndFiles()
        {
            var owner = Db.AddUser("owner");
            var a = AddPending(owner, Db.AddCollection(owner));
            var b = AddPending(owner, Db.AddCollection(owner));

            var response = await _api.ClientFor(owner).DeleteAsync("api/Account");

            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
            AssertGone(a, b);
        }

        public void Dispose() => _api.Dispose();
    }
}
