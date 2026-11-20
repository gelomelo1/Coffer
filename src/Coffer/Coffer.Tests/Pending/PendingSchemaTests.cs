using System.Text.Json;
using Coffer.Domain.Entities;
using Attribute = Coffer.Domain.Entities.Attribute;

namespace Coffer.Tests.Pending
{
    /// <summary>The waiting-for-review list's table, and which attributes must be filled before an item is added.</summary>
    [Collection("api")]
    public class PendingSchemaTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private TestDb Db => _api.Db;

        [Fact]
        public void PendingItemRoundTrips()
        {
            var owner = Db.AddUser("owner");
            var collection = Db.AddCollection(owner);
            var created = new DateTime(2026, 11, 20, 10, 0, 0, DateTimeKind.Utc);
            var pending = new PendingItem { Id = Guid.NewGuid(), UserId = owner.Id, CollectionId = collection.Id, Quantity = 3, Image = "abc.jpg", CreatedAt = created };
            Db.Context.PendingItems.Add(pending);
            Db.Context.SaveChanges();

            using var fresh = Db.NewContext();
            var row = fresh.PendingItems.Single(p => p.Id == pending.Id);
            Assert.Equal(owner.Id, row.UserId);
            Assert.Equal(collection.Id, row.CollectionId);
            Assert.Equal(3, row.Quantity);
            Assert.Equal("abc.jpg", row.Image);
            Assert.Equal(created, DateTime.SpecifyKind(row.CreatedAt, DateTimeKind.Utc));
        }

        [Fact]
        public void PrimaryIsAlwaysRequired()
        {
            Assert.True(AttributeRules.IsRequired(new Attribute { Primary = true, Required = false }));
            Assert.True(AttributeRules.IsRequired(new Attribute { Primary = false, Required = true }));
            Assert.False(AttributeRules.IsRequired(new Attribute { Primary = false, Required = false }));
        }

        [Fact]
        public async Task AttributesApiExposesRequired()
        {
            var owner = Db.AddUser("owner");
            var type = Db.AddCollectionType("Caps");
            Db.Context.Attributes.Add(new Attribute { CollectionTypeId = type.Id, Name = "Brand", Primary = true, Required = true });
            Db.Context.SaveChanges();

            var body = await _api.ClientFor(owner).GetStringAsync("api/Attributes");

            var first = JsonDocument.Parse(body).RootElement.EnumerateArray().First();
            Assert.True(first.GetProperty("required").GetBoolean());
        }

        public void Dispose() => _api.Dispose();
    }
}
