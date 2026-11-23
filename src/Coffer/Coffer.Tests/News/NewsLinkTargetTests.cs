using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Coffer.BusinessLogic.Moderation;
using Coffer.Domain.Constants;
using Coffer.Domain.Entities;
using Coffer.Domain.Marketplace;
using Coffer.Tests.Deletion;
using Microsoft.Extensions.DependencyInjection;
using Attribute = Coffer.Domain.Entities.Attribute;

namespace Coffer.Tests.News
{
    /// <summary>The Manager's "insert app link" picker: finds live users, collections, items, listings and news by name.</summary>
    [Collection("api")]
    public class NewsLinkTargetTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private TestDb Db => _api.Db;
        private readonly Coffer.Domain.Moderation.ManagerAdmin _admin;

        public NewsLinkTargetTests()
        {
            _api.Overrides = services => services.AddSingleton(ManagerAdminConfig.Parse("[\"1001\"]"));
            _admin = Db.AddManagerAdmin("1001");
        }

        private HttpClient Admin() => _api.ManagerClientFor(_admin);

        private async Task<List<JsonElement>> Targets(string type, string? query)
        {
            var response = await Admin().GetAsync($"api/Admin/News/LinkTargets?type={type}&query={Uri.EscapeDataString(query ?? "")}");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.EnumerateArray().ToList();
        }

        private static string Label(JsonElement e) => e.GetProperty("label").GetString()!;

        /// <summary>An item whose primary attribute (the item's name) is <paramref name="name"/>.</summary>
        private ItemProvided NamedItem(CollectionProvided collection, string? name, string? description = null)
        {
            var attribute = Db.Context.Attributes.FirstOrDefault(a => a.CollectionTypeId == collection.CollectionTypeId && a.Primary);
            if (attribute == null)
            {
                attribute = new Attribute { CollectionTypeId = collection.CollectionTypeId, Name = "Name", DataType = AttributeType.String, Primary = true };
                Db.Context.Attributes.Add(attribute);
                Db.Context.SaveChanges();
            }
            var item = Db.AddItem(collection);
            item.Description = description;
            if (name != null) Db.Context.ItemAttributes.Add(new ItemAttribute { ItemId = item.Id, AttributeId = attribute.Id, ValueString = name });
            Db.Context.SaveChanges();
            return item;
        }

        [Fact]
        public async Task LinkTargetsFindByName()
        {
            var owner = Db.AddUser("Zsofia Kovacs");
            var collection = Db.AddCollection(owner);
            collection.Name = "Roman coins";
            Db.Context.SaveChanges();
            var item = NamedItem(collection, "Denarius of Trajan");
            var medal = NamedItem(collection, null, "Bronze medal from 1896");
            var listing = new MarketRows(Db).Listing(owner, title: "Silver denarius lot");
            var news = await Admin().PostAsJsonAsync("api/Admin/News", new { title = "Summer update", content = "" });
            var newsId = JsonDocument.Parse(await news.Content.ReadAsStringAsync()).RootElement.GetProperty("id").GetGuid();

            var user = Assert.Single(await Targets("user", "zsofia"));
            Assert.Equal("Zsofia Kovacs", Label(user));
            Assert.Equal($"coffer://user/{owner.Id}", user.GetProperty("link").GetString());
            Assert.Equal("user", user.GetProperty("type").GetString());
            Assert.Equal(owner.Id, user.GetProperty("id").GetGuid());

            var found = Assert.Single(await Targets("collection", "ROMAN"));
            Assert.Equal("Roman coins", Label(found));
            Assert.Equal("Zsofia Kovacs", found.GetProperty("detail").GetString());
            Assert.Equal($"coffer://collection/{collection.Id}", found.GetProperty("link").GetString());

            var trajan = Assert.Single(await Targets("item", "trajan"));
            Assert.Equal("Denarius of Trajan", Label(trajan));
            Assert.Equal("Roman coins", trajan.GetProperty("detail").GetString());
            Assert.Equal($"coffer://item/{item.Id}", trajan.GetProperty("link").GetString());
            var bronze = Assert.Single(await Targets("item", "bronze"));
            Assert.Equal("Bronze medal from 1896", Label(bronze));
            Assert.Equal(medal.Id, bronze.GetProperty("id").GetGuid());

            var lot = Assert.Single(await Targets("listing", "denarius"));
            Assert.Equal("Silver denarius lot", Label(lot));
            Assert.Equal("Zsofia Kovacs", lot.GetProperty("detail").GetString());
            Assert.Equal($"coffer://listing/{listing.Id}", lot.GetProperty("link").GetString());

            var post = Assert.Single(await Targets("news", "summer"));
            Assert.Equal("Summer update", Label(post));
            Assert.Equal("draft", post.GetProperty("detail").GetString());
            Assert.Equal($"coffer://news/{newsId}", post.GetProperty("link").GetString());

            Assert.Empty(await Targets("user", "nobody-by-this-name"));
            Assert.Equal(2, (await Targets("item", "")).Count);
        }

        [Fact]
        public async Task LinkTargetsAreAtMostTwenty()
        {
            var owner = Db.AddUser("Lots");
            for (var i = 0; i < 25; i++) Db.AddCollection(owner, Db.AddCollectionType($"Type{i}").Id, $"Shelf {i}");
            Assert.Equal(20, (await Targets("collection", "shelf")).Count);
        }

        [Fact]
        public async Task LinkTargetsSkipHiddenAndDeleted()
        {
            var rows = new MarketRows(Db);
            var gone = Db.AddUser("Gone Collector");
            gone.DeletedAt = DateTime.UtcNow;
            var owner = Db.AddUser("Visible Owner");
            var shown = Db.AddCollection(owner);
            shown.Name = "Hidden-test shown";
            var hiddenType = Db.AddCollectionType("Secret");
            hiddenType.Published = false;
            Db.Context.SaveChanges();
            var hidden = Db.AddCollection(owner, hiddenType.Id, "Hidden-test unpublished type");
            var deleted = Db.AddCollection(owner, shown.CollectionTypeId, "Hidden-test deleted");
            deleted.DeletedAt = DateTime.UtcNow;
            var ofGone = Db.AddCollection(gone, shown.CollectionTypeId, "Hidden-test owner gone");
            Db.Context.SaveChanges();

            NamedItem(shown, "Hidden-test live item");
            NamedItem(shown, "Hidden-test tombstoned item").DeletedAt = DateTime.UtcNow;
            NamedItem(hidden, "Hidden-test item of hidden type");
            NamedItem(deleted, "Hidden-test item of deleted collection");
            Db.Context.SaveChanges();

            rows.Listing(owner, title: "Hidden-test live listing");
            rows.Listing(owner, ListingStatus.Removed, "Hidden-test removed listing");
            rows.Listing(owner, title: "Hidden-test deleted listing").DeletedAt = DateTime.UtcNow;
            rows.Listing(gone, title: "Hidden-test listing of gone user");
            Db.Context.SaveChanges();

            Assert.Empty(await Targets("user", "gone collector"));
            Assert.Equal(new[] { "Hidden-test shown" }, (await Targets("collection", "hidden-test")).Select(Label));
            Assert.Equal(new[] { "Hidden-test live item" }, (await Targets("item", "hidden-test")).Select(Label));
            Assert.Equal(new[] { "Hidden-test live listing" }, (await Targets("listing", "hidden-test")).Select(Label));
        }

        [Fact]
        public async Task UnknownTypeIs400()
        {
            var response = await Admin().GetAsync("api/Admin/News/LinkTargets?type=deal&query=x");
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("unknownLinkTargetType", JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.GetProperty("code").GetString());
        }

        [Fact]
        public async Task LinkTargetsAreAdminOnly()
        {
            var roleAdmin = Db.AddUser("legacy-admin", UserRole.Admin);
            var former = Db.AddManagerAdmin("2002", "former");
            const string url = "api/Admin/News/LinkTargets?type=user&query=a";
            Assert.Equal(HttpStatusCode.Unauthorized, (await _api.ClientFor(null).GetAsync(url)).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await _api.ClientFor(roleAdmin).GetAsync(url)).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await _api.ManagerClientFor(former).GetAsync(url)).StatusCode);
        }

        public void Dispose() => _api.Dispose();
    }
}
