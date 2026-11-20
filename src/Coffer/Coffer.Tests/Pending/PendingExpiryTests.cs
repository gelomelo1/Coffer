using System.Net;
using System.Text.Json;
using Coffer.Domain.Entities;
using Microsoft.Extensions.DependencyInjection;

namespace Coffer.Tests.Pending
{
    /// <summary>Waiting items expire 30 days after their photo was checked; the last 3 days are announced.</summary>
    [Collection("api")]
    public class PendingExpiryTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private TestDb Db => _api.Db;

        private static string PendingPath(Guid id, string ext) => Path.Combine(TestEnvironment.Pending, $"{id}.{ext}");

        private PendingItem AddPending(User owner, CollectionProvided collection, TimeSpan age)
        {
            var id = Guid.NewGuid();
            File.WriteAllBytes(PendingPath(id, "jpg"), new byte[] { 1 });
            File.WriteAllBytes(PendingPath(id, "npy"), new byte[] { 1 });
            var row = new PendingItem { Id = id, UserId = owner.Id, CollectionId = collection.Id, Quantity = 1, Image = $"{id}.jpg", CreatedAt = DateTime.UtcNow - age };
            Db.Context.PendingItems.Add(row);
            Db.Context.SaveChanges();
            return row;
        }

        private static async Task<JsonElement> Json(HttpResponseMessage r) => JsonDocument.Parse(await r.Content.ReadAsStringAsync()).RootElement;

        [Fact]
        public async Task SweepRemovesItemsOlderThan30DaysAndTheirFiles()
        {
            var owner = Db.AddUser("owner");
            var collection = Db.AddCollection(owner);
            var expired = AddPending(owner, collection, TimeSpan.FromDays(31));
            var young = AddPending(owner, collection, TimeSpan.FromDays(29));
            _ = _api.CreateClient(); // builds the host

            await new Coffer.BusinessLogic.Marketplace.MarketplaceMaintenanceService(_api.Services.GetRequiredService<IServiceScopeFactory>()).RunOnceAsync();

            using var fresh = Db.NewContext();
            Assert.False(fresh.PendingItems.Any(p => p.Id == expired.Id));
            Assert.False(File.Exists(PendingPath(expired.Id, "jpg")));
            Assert.False(File.Exists(PendingPath(expired.Id, "npy")));
            Assert.True(fresh.PendingItems.Any(p => p.Id == young.Id));
            Assert.True(File.Exists(PendingPath(young.Id, "jpg")));
        }

        [Fact]
        public async Task SummaryReportsItemsExpiringSoon()
        {
            var owner = Db.AddUser("owner");
            var collection = Db.AddCollection(owner);
            var soonest = AddPending(owner, collection, TimeSpan.FromDays(28));      // expires in 2 days
            AddPending(owner, collection, TimeSpan.FromDays(27.5));                  // in 2.5 days
            AddPending(owner, collection, TimeSpan.FromDays(10));                    // in 20 days

            var summary = (await Json(await _api.ClientFor(owner).GetAsync("api/Pending/Summary")))[0];

            Assert.Equal(3, summary.GetProperty("count").GetInt32());
            Assert.Equal(2, summary.GetProperty("expiringSoon").GetInt32());
            var next = DateTime.SpecifyKind(summary.GetProperty("nextExpiresAt").GetDateTime(), DateTimeKind.Utc);
            Assert.Equal(soonest.CreatedAt.AddDays(30), next, TimeSpan.FromSeconds(1));
        }

        [Fact]
        public async Task ListShowsWhenEachItemExpires()
        {
            var owner = Db.AddUser("owner");
            var collection = Db.AddCollection(owner);
            var row = AddPending(owner, collection, TimeSpan.FromDays(5));
            _api.Python.Responder = _ => (HttpStatusCode.OK, "{\"status\":\"ok\",\"response\":[]}");

            var item = (await Json(await _api.ClientFor(owner).GetAsync($"api/Collections/{collection.Id}/Pending?page=1"))).GetProperty("items")[0];

            var expires = DateTime.SpecifyKind(item.GetProperty("expiresAt").GetDateTime(), DateTimeKind.Utc);
            Assert.Equal(row.CreatedAt.AddDays(30), expires, TimeSpan.FromSeconds(1));
        }

        public void Dispose() => _api.Dispose();
    }
}
