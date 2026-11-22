using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Coffer.BusinessLogic.Moderation;
using Coffer.Domain.Constants;
using Coffer.Domain.Entities;
using Microsoft.Extensions.DependencyInjection;
using Attribute = Coffer.Domain.Entities.Attribute;

namespace Coffer.Tests.ItemTypes
{
    /// <summary>api/Admin/ItemTypes and api/Admin/Attributes: Manager administrators only; data items use is protected.</summary>
    [Collection("api")]
    public class ItemTypeAdminTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private TestDb Db => _api.Db;
        private readonly Coffer.Domain.Moderation.ManagerAdmin _admin;

        public ItemTypeAdminTests()
        {
            _api.Overrides = services => services.AddSingleton(ManagerAdminConfig.Parse("[\"1001\"]"));
            _admin = Db.AddManagerAdmin("1001");
        }

        private HttpClient Admin() => _api.ManagerClientFor(_admin);

        private static async Task<JsonElement> Json(HttpResponseMessage response) =>
            JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

        private static async Task<string> Code(HttpResponseMessage response) => (await Json(response)).GetProperty("code").GetString()!;

        private static object TypeBody(string name = "Coins", object? nameTranslations = null, string color = "#A98D3C") =>
            new { name, nameTranslations = nameTranslations ?? new Dictionary<string, string> { ["hu"] = "Érmék" }, description = "Old coins", descriptionTranslations = new Dictionary<string, string>(), color };

        private async Task<int> CreateType(string name = "Coins")
        {
            var response = await Admin().PostAsJsonAsync("api/Admin/ItemTypes", TypeBody(name));
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return (await Json(response)).GetProperty("id").GetInt32();
        }

        private static object AttributeBody(string name, AttributeType type = AttributeType.String, bool primary = false, bool required = false, int? optionSetId = null) =>
            new { name, nameTranslations = new Dictionary<string, string>(), dataType = (int)type, primary, required, optionSetId };

        private async Task<int> AddAttribute(int typeId, string name, AttributeType type = AttributeType.String, bool primary = false, int? optionSetId = null)
        {
            var response = await Admin().PostAsJsonAsync($"api/Admin/ItemTypes/{typeId}/Attributes", AttributeBody(name, type, primary, optionSetId: optionSetId));
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return (await Json(response)).GetProperty("id").GetInt32();
        }

        private ItemOptions OptionSet()
        {
            var set = new ItemOptions { OptionIds = "1;2", OptionLabels = "Logo;Flag" };
            Db.Context.ItemOptions.Add(set);
            Db.Context.SaveChanges();
            return set;
        }

        [Fact]
        public async Task CreateStartsUnpublished()
        {
            var id = await CreateType();

            var type = await Json(await Admin().GetAsync($"api/Admin/ItemTypes/{id}"));
            Assert.False(type.GetProperty("published").GetBoolean());
            Assert.Equal("Érmék", type.GetProperty("nameTranslations").GetProperty("hu").GetString());
            Assert.Contains("itemTypeNeedsModels", type.GetProperty("publishBlockers").EnumerateArray().Select(b => b.GetString()));
            using var fresh = Db.NewContext();
            Assert.False(fresh.CollectionTypes.Single(t => t.Id == id).Published);
        }

        [Fact]
        public async Task UpdateChangesNamesAndTranslations()
        {
            var id = await CreateType();

            var response = await Admin().PutAsJsonAsync($"api/Admin/ItemTypes/{id}", TypeBody("Coins of Europe", new Dictionary<string, string> { ["hu"] = "Európai érmék" }, "#112233"));

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            using var fresh = Db.NewContext();
            var type = fresh.CollectionTypes.Single(t => t.Id == id);
            Assert.Equal("Coins of Europe", type.Name);
            Assert.Equal("Európai érmék", type.NameTranslations["hu"]);
            Assert.Equal("#112233", type.Color);
        }

        [Fact]
        public async Task InvalidTranslationsAre400()
        {
            var response = await Admin().PostAsJsonAsync("api/Admin/ItemTypes", TypeBody(nameTranslations: new Dictionary<string, string> { ["en"] = "Coins" }));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("invalidTranslations", await Code(response));
        }

        [Fact]
        public async Task InvalidColorIs400()
        {
            var response = await Admin().PostAsJsonAsync("api/Admin/ItemTypes", TypeBody(color: "red"));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task DeleteUsedTypeIsRefused()
        {
            var id = await CreateType();
            Db.AddCollection(Db.AddUser("me"), id, "Coins");

            var response = await Admin().DeleteAsync($"api/Admin/ItemTypes/{id}");

            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
            Assert.Equal("itemTypeInUse", await Code(response));
            Assert.True(Db.NewContext().CollectionTypes.Any(t => t.Id == id));
        }

        [Fact]
        public async Task DeleteUnusedUnpublishedType()
        {
            var id = await CreateType();
            await AddAttribute(id, "Country", primary: true);

            var response = await Admin().DeleteAsync($"api/Admin/ItemTypes/{id}");

            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
            using var fresh = Db.NewContext();
            Assert.False(fresh.CollectionTypes.Any(t => t.Id == id));
            Assert.False(fresh.Attributes.Any(a => a.CollectionTypeId == id));
        }

        [Fact]
        public async Task PublishedTypeCantBeDeleted()
        {
            var id = await CreateType();
            var type = Db.Context.CollectionTypes.Single(t => t.Id == id);
            type.Published = true;
            Db.Context.SaveChanges();

            var response = await Admin().DeleteAsync($"api/Admin/ItemTypes/{id}");

            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        }

        [Fact]
        public async Task AttributeInUseCantChangeTypeOrBeDeleted()
        {
            var id = await CreateType();
            var attributeId = await AddAttribute(id, "Country", primary: true);
            var item = Db.AddItem(Db.AddCollection(Db.AddUser("me"), id, "Coins"));
            Db.Context.ItemAttributes.Add(new ItemAttribute { ItemId = item.Id, AttributeId = attributeId, ValueString = "Hungary" });
            Db.Context.SaveChanges();

            var retype = await Admin().PutAsJsonAsync($"api/Admin/Attributes/{attributeId}", AttributeBody("Country", AttributeType.Number, primary: true));
            var delete = await Admin().DeleteAsync($"api/Admin/Attributes/{attributeId}");

            Assert.Equal(HttpStatusCode.Conflict, retype.StatusCode);
            Assert.Equal("attributeInUse", await Code(retype));
            Assert.Equal(HttpStatusCode.Conflict, delete.StatusCode);
            using var fresh = Db.NewContext();
            Assert.Equal(AttributeType.String, fresh.Attributes.Single(a => a.Id == attributeId).DataType);
        }

        [Fact]
        public async Task RenamingAttributeInUseIsAllowed()
        {
            var id = await CreateType();
            var attributeId = await AddAttribute(id, "Country", primary: true);
            var item = Db.AddItem(Db.AddCollection(Db.AddUser("me"), id, "Coins"));
            Db.Context.ItemAttributes.Add(new ItemAttribute { ItemId = item.Id, AttributeId = attributeId, ValueString = "Hungary" });
            Db.Context.SaveChanges();

            var response = await Admin().PutAsJsonAsync($"api/Admin/Attributes/{attributeId}", new
            {
                name = "Country of issue", nameTranslations = new Dictionary<string, string> { ["hu"] = "Kibocsátó ország" },
                dataType = (int)AttributeType.String, primary = true, required = true, optionSetId = (int?)null,
            });

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(1, (await Json(response)).GetProperty("usedByItems").GetInt32());
            Assert.Equal("Country of issue", Db.NewContext().Attributes.Single(a => a.Id == attributeId).Name);
        }

        [Fact]
        public async Task SelectNeedsOptionSet()
        {
            var id = await CreateType();
            var set = OptionSet();

            var missing = await Admin().PostAsJsonAsync($"api/Admin/ItemTypes/{id}/Attributes", AttributeBody("Motif", AttributeType.Select));
            var notAllowed = await Admin().PostAsJsonAsync($"api/Admin/ItemTypes/{id}/Attributes", AttributeBody("Year", AttributeType.Number, optionSetId: set.Id));
            var ok = await Admin().PostAsJsonAsync($"api/Admin/ItemTypes/{id}/Attributes", AttributeBody("Motif", AttributeType.Multi_Select, optionSetId: set.Id));

            Assert.Equal("optionSetRequired", await Code(missing));
            Assert.Equal("optionSetNotAllowed", await Code(notAllowed));
            Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        }

        [Fact]
        public async Task MakingPrimaryClearsTheOther()
        {
            var id = await CreateType();
            var country = await AddAttribute(id, "Country", primary: true);
            var year = await AddAttribute(id, "Year", AttributeType.Number);

            await Admin().PutAsJsonAsync($"api/Admin/Attributes/{year}", AttributeBody("Year", AttributeType.Number, primary: true));

            using var fresh = Db.NewContext();
            Assert.False(fresh.Attributes.Single(a => a.Id == country).Primary);
            Assert.True(fresh.Attributes.Single(a => a.Id == year).Primary);
        }

        [Fact]
        public async Task DuplicateAttributeNameIs409()
        {
            var id = await CreateType();
            await AddAttribute(id, "Country");

            var response = await Admin().PostAsJsonAsync($"api/Admin/ItemTypes/{id}/Attributes", AttributeBody("country"));

            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
            Assert.Equal("attributeNameTaken", await Code(response));
        }

        [Fact]
        public async Task ChangesAreAudited()
        {
            var id = await CreateType();
            var attributeId = await AddAttribute(id, "Country");
            await Admin().PutAsJsonAsync($"api/Admin/ItemTypes/{id}", TypeBody("Coins 2"));
            await Admin().DeleteAsync($"api/Admin/Attributes/{attributeId}");
            await Admin().DeleteAsync($"api/Admin/ItemTypes/{id}");

            using var fresh = Db.NewContext();
            var actions = fresh.AdminAuditLog.Where(a => a.AdminId == _admin.Id).OrderBy(a => a.CreatedAt).Select(a => a.Action).ToList();
            Assert.Equal(new[] { "itemType.create", "attribute.create", "itemType.update", "attribute.delete", "itemType.delete" }, actions);
            Assert.All(fresh.AdminAuditLog.Where(a => a.AdminId == _admin.Id), a => Assert.Contains($"\"itemTypeId\":{id}", a.Details));
        }

        /// <summary>Every item type admin route, with a body where it takes one.</summary>
        public static IEnumerable<(HttpMethod Method, string Url)> AdminRoutes(int typeId, int attributeId, int optionSetId) => new[]
        {
            (HttpMethod.Get, "api/Admin/ItemTypes"),
            (HttpMethod.Get, $"api/Admin/ItemTypes/{typeId}"),
            (HttpMethod.Post, "api/Admin/ItemTypes"),
            (HttpMethod.Put, $"api/Admin/ItemTypes/{typeId}"),
            (HttpMethod.Delete, $"api/Admin/ItemTypes/{typeId}"),
            (HttpMethod.Post, $"api/Admin/ItemTypes/{typeId}/Attributes"),
            (HttpMethod.Put, $"api/Admin/Attributes/{attributeId}"),
            (HttpMethod.Delete, $"api/Admin/Attributes/{attributeId}"),
            (HttpMethod.Get, "api/Admin/OptionSets"),
            (HttpMethod.Post, "api/Admin/OptionSets"),
            (HttpMethod.Put, $"api/Admin/OptionSets/{optionSetId}"),
            (HttpMethod.Delete, $"api/Admin/OptionSets/{optionSetId}"),
        };

        [Fact]
        public async Task EveryItemTypeAdminRouteRejectsNonAdmins()
        {
            var id = await CreateType();
            var attributeId = await AddAttribute(id, "Country");
            var roleAdmin = Db.AddUser("legacy-admin", UserRole.Admin);
            var former = Db.AddManagerAdmin("2002", "former");
            var set = OptionSet();
            var before = Db.NewContext().AdminAuditLog.Count();

            foreach (var (method, url) in AdminRoutes(id, attributeId, set.Id))
            {
                HttpRequestMessage Request() => new(method, url)
                {
                    Content = method == HttpMethod.Get || method == HttpMethod.Delete ? null : JsonContent.Create(TypeBody("Hacked")),
                };
                Assert.Equal(HttpStatusCode.Unauthorized, (await _api.ClientFor(null).SendAsync(Request())).StatusCode);
                Assert.Equal(HttpStatusCode.Unauthorized, (await _api.ClientFor(roleAdmin).SendAsync(Request())).StatusCode);
                Assert.Equal(HttpStatusCode.Forbidden, (await _api.ManagerClientFor(former).SendAsync(Request())).StatusCode);
            }

            using var fresh = Db.NewContext();
            Assert.Equal("Coins", fresh.CollectionTypes.Single(t => t.Id == id).Name);
            Assert.True(fresh.Attributes.Any(a => a.Id == attributeId));
            Assert.Equal("Logo;Flag", fresh.ItemOptions.Single(o => o.Id == set.Id).OptionLabels);
            Assert.Equal(before, fresh.AdminAuditLog.Count());
        }

        public void Dispose() => _api.Dispose();
    }
}
