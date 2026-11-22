using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Coffer.Domain.Community;
using Coffer.Domain.Entities;
using Attribute = Coffer.Domain.Entities.Attribute;

namespace Coffer.Tests.ItemTypes
{
    /// <summary>
    /// An unpublished item type is gone from the app — for its owner too — and answers exactly like something that
    /// doesn't exist; nothing is deleted, and publishing it again brings everything back.
    /// </summary>
    [Collection("api")]
    public class HiddenTypeCommunityTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private TestDb Db => _api.Db;

        private readonly User _owner;
        private readonly User _fan;
        private readonly CollectionTypeProvided _shownType;
        private readonly CollectionTypeProvided _hiddenType;
        private readonly CollectionProvided _shown;
        private readonly CollectionProvided _hidden;
        private readonly ItemProvided _shownItem;
        private readonly ItemProvided _hiddenItem;
        private readonly Attribute _hiddenBrand;
        private readonly PendingItem _waiting;

        public HiddenTypeCommunityTests()
        {
            _owner = Db.AddUser("owner");
            _fan = Db.AddUser("fan");
            _shownType = Db.AddCollectionType("Caps");
            _hiddenType = Db.AddCollectionType("Stamps");
            var shownBrand = Brand(_shownType);
            _hiddenBrand = Brand(_hiddenType);
            _shown = Db.AddCollection(_owner, _shownType.Id, "Beer caps");
            _hidden = Db.AddCollection(_owner, _hiddenType.Id, "Stamps of Europe");
            _shownItem = Item(_shown, shownBrand, "Heineken");
            _hiddenItem = Item(_hidden, _hiddenBrand, "Heineken");
            Db.Follow(_fan, _hidden);
            Db.Follow(_fan, _shown);
            Db.Context.Reactions.Add(new ReactionProvided(_fan.Id, _hiddenItem.Id, true, 4));
            var commentId = Guid.NewGuid();
            Db.Context.ItemComments.Add(new ItemComment { Id = commentId, ItemId = _hiddenItem.Id, AuthorId = _fan.Id, Body = "Nice stamp", CreatedAt = DateTime.UtcNow, RootId = commentId });
            _waiting = new PendingItem { Id = Guid.NewGuid(), UserId = _owner.Id, CollectionId = _hidden.Id, Quantity = 1, Image = "w.jpg", CreatedAt = DateTime.UtcNow };
            Db.Context.PendingItems.Add(_waiting);
            Db.Context.SaveChanges();
            SetPublished(false);
        }

        private Attribute Brand(CollectionTypeProvided type)
        {
            var brand = new Attribute { CollectionTypeId = type.Id, Name = "Brand", Primary = true, Required = true };
            Db.Context.Attributes.Add(brand);
            Db.Context.SaveChanges();
            return brand;
        }

        private ItemProvided Item(CollectionProvided collection, Attribute brand, string value)
        {
            var item = Db.AddItem(collection);
            item.AcquiredAt = DateTime.UtcNow;
            item.ItemTags.Add(new ItemTags { ItemId = item.Id, Tag = "rare" });
            Db.Context.ItemAttributes.Add(new ItemAttribute { ItemId = item.Id, AttributeId = brand.Id, ValueString = value });
            Db.Context.SaveChanges();
            return item;
        }

        private void SetPublished(bool published)
        {
            var type = Db.Context.CollectionTypes.Single(t => t.Id == _hiddenType.Id);
            type.Published = published;
            Db.Context.SaveChanges();
        }

        private HttpClient As(User user) => _api.ClientFor(user);

        private static async Task<string> Body(HttpResponseMessage response) => await response.Content.ReadAsStringAsync();

        private async Task<string> Get(User user, string url)
        {
            var response = await As(user).GetAsync(url);
            Assert.True(response.IsSuccessStatusCode, $"{url} → {(int)response.StatusCode}");
            return await Body(response);
        }

        private static string Filter(string expression) => Uri.EscapeDataString(expression);

        [Fact]
        public async Task CatalogueOmitsHiddenType()
        {
            var types = await Get(_owner, "api/CollectionTypes");
            var attributes = await Get(_owner, $"api/Attributes?filter={Filter($"CollectionTypeId == {_hiddenType.Id}")}");

            Assert.Contains("\"Caps\"", types);
            Assert.DoesNotContain("Stamps", types);
            Assert.Equal(HttpStatusCode.NotFound, (await As(_owner).GetAsync($"api/CollectionTypes/{_hiddenType.Id}")).StatusCode);
            Assert.Equal("[]", attributes);
            Assert.Equal(HttpStatusCode.NotFound, (await As(_owner).GetAsync($"api/Attributes/{_hiddenBrand.Id}")).StatusCode);
        }

        [Fact]
        public async Task OwnerCantSeeOrManageHiddenCollections()
        {
            var grouped = await Get(_owner, $"api/Collections/Grouped?userId={_owner.Id}");
            var list = await Get(_owner, $"api/Collections?filter={Filter($"UserId == \"{_owner.Id}\"")}");

            Assert.Contains(_shown.Id.ToString(), grouped);
            Assert.DoesNotContain(_hidden.Id.ToString(), grouped);
            Assert.DoesNotContain(_hidden.Id.ToString(), list);
            Assert.Equal(HttpStatusCode.NotFound, (await As(_owner).GetAsync($"api/Collections/{_hidden.Id}")).StatusCode);
            Assert.False((await As(_owner).PutAsJsonAsync($"api/Collections/{_hidden.Id}", new { userId = _owner.Id, collectionTypeId = _hiddenType.Id, name = "Renamed" })).IsSuccessStatusCode);
            Assert.False((await As(_owner).DeleteAsync($"api/Collections/{_hidden.Id}")).IsSuccessStatusCode);
            Assert.False((await As(_owner).PostAsync($"api/Collections/CoverImage/Upload/{_hidden.Id}", null)).IsSuccessStatusCode);
            Assert.Equal("[]", await Get(_owner, $"api/Collections/ItemTags/{_hidden.Id}"));
            Assert.False((await As(_owner).PostAsJsonAsync("api/Collections", new { userId = _owner.Id, collectionTypeId = _hiddenType.Id, name = "New stamps" })).IsSuccessStatusCode);

            using var fresh = Db.NewContext();
            var stored = fresh.Collections.Single(c => c.Id == _hidden.Id);
            Assert.Equal("Stamps of Europe", stored.Name);
            Assert.Null(stored.DeletedAt);
            Assert.Equal(2, fresh.Collections.Count(c => c.UserId == _owner.Id));
        }

        [Fact]
        public async Task ItemsOfHiddenTypeAreGone()
        {
            var page = JsonDocument.Parse(await Get(_owner, $"api/Items/Page?filter={Filter($"CollectionId == \"{_hidden.Id}\"")}")).RootElement;

            Assert.Equal(0, page.GetProperty("total").GetInt32());
            Assert.Equal(HttpStatusCode.NotFound, (await As(_owner).GetAsync($"api/Items/{_hiddenItem.Id}")).StatusCode);
            Assert.False((await As(_owner).PutAsJsonAsync($"api/Items/{_hiddenItem.Id}", new { collectionId = _hidden.Id, quantity = 5, image = _hiddenItem.Image, itemAttributes = Array.Empty<object>(), itemTags = Array.Empty<object>() })).IsSuccessStatusCode);
            Assert.False((await As(_owner).PostAsJsonAsync("api/Items/Upsert", new[] { new { id = Guid.NewGuid(), item = new { collectionId = _hidden.Id, quantity = 1, image = "x", itemAttributes = Array.Empty<object>(), itemTags = Array.Empty<object>() } } })).IsSuccessStatusCode);
            Assert.False((await As(_owner).DeleteAsync($"api/Items/{_hiddenItem.Id}")).IsSuccessStatusCode);

            using var fresh = Db.NewContext();
            var stored = fresh.Items.Single(i => i.Id == _hiddenItem.Id);
            Assert.Equal(1, stored.Quantity);
            Assert.Null(stored.DeletedAt);
            Assert.Equal(1, fresh.Items.Count(i => i.CollectionId == _hidden.Id));
        }

        [Fact]
        public async Task FeedAndSearchOmitHiddenType()
        {
            var feed = await Get(_fan, "api/Feed");
            var items = await Get(_fan, "api/Feed/Search/Items?searchText=Heineken");
            var stats = await Get(_fan, "api/Feed/TagStats?tags=rare");

            Assert.Contains(_shownItem.Id.ToString(), feed);
            Assert.DoesNotContain(_hiddenItem.Id.ToString(), feed);
            Assert.Contains(_shownItem.Id.ToString(), items);
            Assert.DoesNotContain(_hiddenItem.Id.ToString(), items);
            Assert.Equal(1, JsonDocument.Parse(stats).RootElement[0].GetProperty("itemCount").GetInt32());
        }

        [Fact]
        public async Task FollowsOmitAndRefuseHiddenType()
        {
            var follows = await Get(_fan, "api/Feed/UserFollows");
            var toggle = await As(_fan).PostAsJsonAsync("api/Follows", new { userId = _fan.Id, collectionId = _hidden.Id });

            Assert.Contains(_shown.Id.ToString(), follows);
            Assert.DoesNotContain(_hidden.Id.ToString(), follows);
            Assert.Equal(HttpStatusCode.NotFound, toggle.StatusCode);
            Assert.True(Db.NewContext().Follows.Any(f => f.UserId == _fan.Id && f.CollectionId == _hidden.Id)); // nothing deleted
        }

        [Fact]
        public async Task ReactionsAndCommentsRefuseHiddenItems()
        {
            var react = await As(_fan).PostAsJsonAsync("api/Reactions", new { userId = _fan.Id, itemId = _hiddenItem.Id, liked = false, rarity = (int?)null });
            var list = await As(_fan).GetAsync($"api/Items/{_hiddenItem.Id}/Comments");
            var post = await As(_fan).PostAsJsonAsync($"api/Items/{_hiddenItem.Id}/Comments", new { body = "Still here?" });
            var counts = await Get(_fan, $"api/Comments/Counts?itemIds={_hiddenItem.Id}");
            var reactions = await Get(_fan, $"api/Reactions?filter={Filter($"ItemId == \"{_hiddenItem.Id}\"")}");

            Assert.False(react.IsSuccessStatusCode);
            Assert.Equal(HttpStatusCode.NotFound, list.StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, post.StatusCode);
            Assert.Equal("{}", counts);
            Assert.Equal("[]", reactions);
            using var fresh = Db.NewContext();
            Assert.True(fresh.Reactions.Single(r => r.ItemId == _hiddenItem.Id).Liked);
            Assert.Equal(1, fresh.ItemComments.Count(c => c.ItemId == _hiddenItem.Id));
        }

        [Fact]
        public async Task WaitingListOmitsHiddenType()
        {
            var summary = await Get(_owner, "api/Pending/Summary");

            Assert.Equal("[]", summary);
            Assert.Equal(HttpStatusCode.NotFound, (await As(_owner).GetAsync($"api/Collections/{_hidden.Id}/Pending")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await As(_owner).GetAsync($"api/Pending/Image/{_waiting.Id}")).StatusCode);
            // Deleting is idempotent: a hidden item answers like an already-gone one (204) and stays.
            await As(_owner).DeleteAsync($"api/Pending/{_waiting.Id}");
            Assert.Equal(HttpStatusCode.NotFound, (await As(_owner).PostAsJsonAsync($"api/Pending/{_waiting.Id}/Add", new { matchItemId = _hiddenItem.Id, quantity = 1 })).StatusCode);
            Assert.True(Db.NewContext().PendingItems.Any(p => p.Id == _waiting.Id));
        }

        [Fact]
        public async Task PublishingAgainRestoresEverything()
        {
            SetPublished(true);

            Assert.Contains("Stamps", await Get(_owner, "api/CollectionTypes"));
            Assert.Contains(_hidden.Id.ToString(), await Get(_owner, $"api/Collections/Grouped?userId={_owner.Id}"));
            Assert.Equal(HttpStatusCode.OK, (await As(_owner).GetAsync($"api/Items/{_hiddenItem.Id}")).StatusCode);
            Assert.Contains(_hiddenItem.Id.ToString(), await Get(_fan, "api/Feed"));
            Assert.Contains(_hidden.Id.ToString(), await Get(_fan, "api/Feed/UserFollows"));
            Assert.Equal(HttpStatusCode.OK, (await As(_fan).GetAsync($"api/Items/{_hiddenItem.Id}/Comments")).StatusCode);
            Assert.Contains(_hidden.Id.ToString(), await Get(_owner, "api/Pending/Summary"));
        }

        public void Dispose() => _api.Dispose();
    }
}
