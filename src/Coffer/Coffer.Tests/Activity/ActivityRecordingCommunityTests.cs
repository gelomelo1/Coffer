using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Coffer.Domain.Entities;
using Attribute = Coffer.Domain.Entities.Attribute;

namespace Coffer.Tests.Activity
{
    /// <summary>Likes, ratings, comments, collections, items and follows land in the acting user's activity log.</summary>
    [Collection("api")]
    public class ActivityRecordingCommunityTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private TestDb Db => _api.Db;

        private List<ActivityEvent> Events(User user)
        {
            using var fresh = Db.NewContext();
            return fresh.ActivityEvents.Where(e => e.UserId == user.Id).OrderBy(e => e.OccurredAt).ToList();
        }

        private static JsonElement D(ActivityEvent e) => JsonDocument.Parse(e.Details).RootElement;

        private (User me, User owner, ItemProvided item) Someone()
        {
            var me = Db.AddUser("me");
            var owner = Db.AddUser("owner");
            return (me, owner, Db.AddItem(Db.AddCollection(owner)));
        }

        private Task<HttpResponseMessage> React(User me, ItemProvided item, bool liked, int? rarity) =>
            _api.ClientFor(me).PostAsJsonAsync("api/Reactions", new { userId = me.Id, itemId = item.Id, liked, rarity });

        [Fact]
        public async Task LikeAndUnlikeRecorded()
        {
            var (me, _, item) = Someone();

            await React(me, item, true, null);
            await React(me, item, false, null);

            var events = Events(me);
            Assert.Equal(new[] { "reaction.liked", "reaction.unliked" }, events.Select(e => e.Kind));
            Assert.All(events, e => Assert.Equal(item.Id, e.ItemId));
        }

        [Fact]
        public async Task UnlikeRecordsUnliked()
        {
            var (me, _, item) = Someone();
            await React(me, item, true, 4);

            await React(me, item, false, 4); // keeps the rating, removes the like

            var events = Events(me);
            Assert.Equal(new[] { "reaction.liked", "reaction.rated", "reaction.unliked" }, events.Select(e => e.Kind));
        }

        [Fact]
        public async Task ChangingRarityRecordsFromAndTo()
        {
            var (me, _, item) = Someone();

            await React(me, item, false, 3);
            await React(me, item, false, 5);
            await React(me, item, false, null);

            var events = Events(me);
            Assert.Equal(new[] { "reaction.rated", "reaction.rerated", "reaction.unrated" }, events.Select(e => e.Kind));
            Assert.Equal(3, D(events[0]).GetProperty("to").GetInt32());
            Assert.Equal(3, D(events[1]).GetProperty("from").GetInt32());
            Assert.Equal(5, D(events[1]).GetProperty("to").GetInt32());
            Assert.Equal(5, D(events[2]).GetProperty("from").GetInt32());
        }

        [Fact]
        public async Task CommentKindsRecorded()
        {
            var (me, _, item) = Someone();
            var client = _api.ClientFor(me);

            var posted = JsonDocument.Parse(await (await client.PostAsJsonAsync($"api/Items/{item.Id}/Comments", new { body = "Nice cap!" })).Content.ReadAsStringAsync()).RootElement.GetProperty("id").GetGuid();
            var reply = JsonDocument.Parse(await (await client.PostAsJsonAsync($"api/Items/{item.Id}/Comments", new { body = "And a reply", parentId = posted })).Content.ReadAsStringAsync()).RootElement.GetProperty("id").GetGuid();
            await client.PutAsJsonAsync($"api/Items/{item.Id}/Comments/{posted}", new { body = "Nice cap, really!" });
            await client.DeleteAsync($"api/Items/{item.Id}/Comments/{reply}");

            var events = Events(me);
            Assert.Equal(new[] { "comment.posted", "comment.replied", "comment.edited", "comment.deleted" }, events.Select(e => e.Kind));
            Assert.Equal(new Guid?[] { posted, reply, posted, reply }, events.Select(e => e.CommentId));
            Assert.All(events, e => Assert.Equal(item.Id, e.ItemId));
        }

        [Fact]
        public async Task CollectionKindsRecorded()
        {
            var me = Db.AddUser("me");
            var type = Db.AddCollectionType("Caps");
            var client = _api.ClientFor(me);

            var created = JsonDocument.Parse(await (await client.PostAsJsonAsync("api/Collections", new { userId = me.Id, collectionTypeId = type.Id, name = "Beer caps" })).Content.ReadAsStringAsync()).RootElement.GetProperty("id").GetGuid();
            await client.PutAsJsonAsync($"api/Collections/{created}", new { userId = me.Id, collectionTypeId = type.Id, name = "Beer caps of Europe" });
            await client.DeleteAsync($"api/Collections/{created}");

            var events = Events(me);
            Assert.Equal(new[] { "collection.created", "collection.edited", "collection.deleted" }, events.Select(e => e.Kind));
            Assert.All(events, e => Assert.Equal(created, e.CollectionId));
        }

        [Fact]
        public async Task ItemKindsRecorded()
        {
            var me = Db.AddUser("me");
            var collection = Db.AddCollection(me);
            var tempId = Guid.NewGuid();
            File.WriteAllBytes(Path.Combine(TestEnvironment.Temp, $"{tempId}.jpg"), new byte[] { 0xFF, 0xD8, 0xFF });
            var client = _api.ClientFor(me);

            await client.PostAsJsonAsync("api/Items/Upsert", new[]
            {
                new { id = tempId, item = new { collectionId = collection.Id, quantity = 2, image = "x", itemAttributes = Array.Empty<object>(), itemTags = Array.Empty<object>() } },
            });
            var item = Db.NewContext().Items.Single(i => i.CollectionId == collection.Id);
            await client.PutAsJsonAsync($"api/Items/{item.Id}", new { collectionId = collection.Id, quantity = 3, image = item.Image, itemAttributes = Array.Empty<object>(), itemTags = Array.Empty<object>() });
            await client.DeleteAsync($"api/Items/{item.Id}");

            var events = Events(me);
            Assert.Equal(new[] { "item.added", "item.edited", "item.deleted" }, events.Select(e => e.Kind));
            Assert.All(events, e => Assert.Equal(item.Id, e.ItemId));
            Assert.Equal(2, D(events[0]).GetProperty("quantity").GetInt32());
            Assert.Equal(collection.Id, events[0].CollectionId);
        }

        [Fact]
        public async Task QuantityZeroRecordsItemDeleted()
        {
            var me = Db.AddUser("me");
            var collection = Db.AddCollection(me);
            var item = Db.AddItem(collection);

            await _api.ClientFor(me).PutAsJsonAsync($"api/Items/{item.Id}", new { collectionId = collection.Id, quantity = 0, image = item.Image, itemAttributes = Array.Empty<object>(), itemTags = Array.Empty<object>() });

            Assert.Equal(new[] { "item.deleted" }, Events(me).Select(e => e.Kind));
        }

        [Fact]
        public async Task PendingAddRecordsAddedOrAddedToExisting()
        {
            var me = Db.AddUser("me");
            var type = Db.AddCollectionType("Caps");
            var brand = new Attribute { CollectionTypeId = type.Id, Name = "Brand", Primary = true, Required = true };
            Db.Context.Attributes.Add(brand);
            Db.Context.SaveChanges();
            var collection = Db.AddCollection(me, type.Id, "Caps");
            var match = Db.AddItem(collection);
            PendingItem Pending()
            {
                var id = Guid.NewGuid();
                File.WriteAllBytes(Path.Combine(TestEnvironment.Pending, $"{id}.jpg"), new byte[] { 0xFF, 0xD8, 0xFF });
                File.WriteAllBytes(Path.Combine(TestEnvironment.Pending, $"{id}.npy"), new byte[] { 1 });
                var row = new PendingItem { Id = id, UserId = me.Id, CollectionId = collection.Id, Quantity = 1, Image = $"{id}.jpg", CreatedAt = DateTime.UtcNow };
                Db.Context.PendingItems.Add(row);
                Db.Context.SaveChanges();
                return row;
            }
            var a = Pending();
            var b = Pending();
            var client = _api.ClientFor(me);

            await client.PostAsJsonAsync($"api/Pending/{a.Id}/Add", new { matchItemId = match.Id, quantity = 2 });
            var created = JsonDocument.Parse(await (await client.PostAsJsonAsync($"api/Pending/{b.Id}/Add", new
            {
                item = new { collectionId = collection.Id, quantity = 1, image = "", itemAttributes = new[] { new { attributeId = brand.Id, valueString = "Heineken" } }, itemTags = Array.Empty<object>() },
                quantity = 1,
            })).Content.ReadAsStringAsync()).RootElement.GetProperty("id").GetGuid();

            var events = Events(me);
            Assert.Equal(new[] { "item.addedToExisting", "item.added" }, events.Select(e => e.Kind));
            Assert.Equal(match.Id, events[0].ItemId);
            Assert.Equal(2, D(events[0]).GetProperty("quantity").GetInt32());
            Assert.Equal(created, events[1].ItemId);
        }

        [Fact]
        public async Task FollowKindsRecorded()
        {
            var me = Db.AddUser("me");
            var collection = Db.AddCollection(Db.AddUser("owner"));
            var client = _api.ClientFor(me);

            await client.PostAsJsonAsync("api/Follows", new { userId = me.Id, collectionId = collection.Id });
            await client.PostAsJsonAsync("api/Follows", new { userId = me.Id, collectionId = collection.Id });

            var events = Events(me);
            Assert.Equal(new[] { "follow.followed", "follow.unfollowed" }, events.Select(e => e.Kind));
            Assert.All(events, e => Assert.Equal(collection.Id, e.CollectionId));
        }

        [Fact]
        public async Task FailedActionRecordsNothing()
        {
            var me = Db.AddUser("me");
            var others = Db.AddCollection(Db.AddUser("owner"));

            var forbidden = await _api.ClientFor(me).PutAsJsonAsync($"api/Collections/{others.Id}", new { userId = me.Id, collectionTypeId = others.CollectionTypeId, name = "Mine now" });

            Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
            Assert.Empty(Events(me));
        }

        public void Dispose() => _api.Dispose();
    }
}
