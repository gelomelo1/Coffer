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
    /// <summary>api/Admin/OptionSets: the lists select attributes pick from. An option items use can't be removed.</summary>
    [Collection("api")]
    public class OptionSetAdminTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private TestDb Db => _api.Db;
        private readonly Coffer.Domain.Moderation.ManagerAdmin _admin;

        public OptionSetAdminTests()
        {
            _api.Overrides = services => services.AddSingleton(ManagerAdminConfig.Parse("[\"1001\"]"));
            _admin = Db.AddManagerAdmin("1001");
        }

        private HttpClient Admin() => _api.ManagerClientFor(_admin);

        private static async Task<JsonElement> Json(HttpResponseMessage response) =>
            JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

        private static async Task<string> Code(HttpResponseMessage response) => (await Json(response)).GetProperty("code").GetString()!;

        private static object Body(IEnumerable<(int? Id, string Label)> options, Dictionary<string, string>? translations = null) => new
        {
            options = options.Select(o => new { id = o.Id, label = o.Label }).ToArray(),
            labelTranslations = translations ?? new Dictionary<string, string>(),
        };

        private async Task<JsonElement> Create(params string[] labels)
        {
            var response = await Admin().PostAsJsonAsync("api/Admin/OptionSets", Body(labels.Select(l => ((int?)null, l))));
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return await Json(response);
        }

        private static List<(int Id, string Label)> Options(JsonElement set) =>
            set.GetProperty("options").EnumerateArray().Select(o => (o.GetProperty("id").GetInt32(), o.GetProperty("label").GetString()!)).ToList();

        /// <summary>An attribute of a new type using the set, plus one item with the given value.</summary>
        private void UseValue(int setId, AttributeType type, string value)
        {
            var itemType = Db.AddCollectionType($"Type {Guid.NewGuid():N}");
            var attribute = new Attribute { CollectionTypeId = itemType.Id, Name = "Motif", DataType = type, ItemOptionsId = setId };
            Db.Context.Attributes.Add(attribute);
            Db.Context.SaveChanges();
            var item = Db.AddItem(Db.AddCollection(Db.AddUser("u" + Guid.NewGuid().ToString("N")[..8]), itemType.Id, "C"));
            Db.Context.ItemAttributes.Add(new ItemAttribute { ItemId = item.Id, AttributeId = attribute.Id, ValueString = value });
            Db.Context.SaveChanges();
        }

        [Fact]
        public async Task CreateAssignsIds()
        {
            var set = await Create("Logo", "Flag", "Landscape");

            Assert.Equal(new[] { (1, "Logo"), (2, "Flag"), (3, "Landscape") }, Options(set));
            using var fresh = Db.NewContext();
            var row = fresh.ItemOptions.Single(o => o.Id == set.GetProperty("id").GetInt32());
            Assert.Equal("1;2;3", row.OptionIds);
            Assert.Equal("Logo;Flag;Landscape", row.OptionLabels);
        }

        [Fact]
        public async Task AddOptionGetsNextId()
        {
            var set = await Create("Logo", "Flag");
            var id = set.GetProperty("id").GetInt32();

            var updated = await Json(await Admin().PutAsJsonAsync($"api/Admin/OptionSets/{id}", Body(new (int?, string)[] { (1, "Logo"), (2, "Flag"), (null, "Coat of arms") })));

            Assert.Equal(new[] { (1, "Logo"), (2, "Flag"), (3, "Coat of arms") }, Options(updated));
        }

        [Fact]
        public async Task RemovedIdIsNeverReused()
        {
            var set = await Create("Logo", "Flag", "Landscape");
            var id = set.GetProperty("id").GetInt32();
            await Admin().PutAsJsonAsync($"api/Admin/OptionSets/{id}", Body(new (int?, string)[] { (1, "Logo"), (2, "Flag") }));

            var updated = await Json(await Admin().PutAsJsonAsync($"api/Admin/OptionSets/{id}", Body(new (int?, string)[] { (1, "Logo"), (2, "Flag"), (null, "Portrait") })));

            Assert.Equal(4, Options(updated)[2].Id);
        }

        [Fact]
        public async Task RenameUsedOptionIsAllowed()
        {
            var set = await Create("Logo", "Flag");
            var id = set.GetProperty("id").GetInt32();
            UseValue(id, AttributeType.Select, "2");

            var response = await Admin().PutAsJsonAsync($"api/Admin/OptionSets/{id}", Body(new (int?, string)[] { (1, "Logo"), (2, "National flag") },
                new Dictionary<string, string> { ["hu"] = "Logó;Nemzeti zászló" }));

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var row = Db.NewContext().ItemOptions.Single(o => o.Id == id);
            Assert.Equal("Logo;National flag", row.OptionLabels);
            Assert.Equal("Logó;Nemzeti zászló", row.OptionLabelsTranslations["hu"]);
            Assert.Equal(1, (await Json(response)).GetProperty("options")[1].GetProperty("usedByItems").GetInt32());
        }

        [Fact]
        public async Task OptionUsedBySelectValueCantBeRemoved()
        {
            var set = await Create("Logo", "Flag");
            var id = set.GetProperty("id").GetInt32();
            UseValue(id, AttributeType.Select, "2");

            var response = await Admin().PutAsJsonAsync($"api/Admin/OptionSets/{id}", Body(new (int?, string)[] { (1, "Logo") }));

            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
            Assert.Equal("optionInUse", await Code(response));
            Assert.Equal("1;2", Db.NewContext().ItemOptions.Single(o => o.Id == id).OptionIds);
        }

        [Fact]
        public async Task OptionUsedInsideMultiSelectValueCantBeRemoved()
        {
            var set = await Create("Logo", "Flag", "Landscape", "Coat of arms");
            var id = set.GetProperty("id").GetInt32();
            UseValue(id, AttributeType.Multi_Select, "1;4;");

            var removeFour = await Admin().PutAsJsonAsync($"api/Admin/OptionSets/{id}", Body(new (int?, string)[] { (1, "Logo"), (2, "Flag"), (3, "Landscape") }));
            var removeThree = await Admin().PutAsJsonAsync($"api/Admin/OptionSets/{id}", Body(new (int?, string)[] { (1, "Logo"), (2, "Flag"), (4, "Coat of arms") }));

            Assert.Equal(HttpStatusCode.Conflict, removeFour.StatusCode);
            Assert.Equal(HttpStatusCode.OK, removeThree.StatusCode);
            Assert.Equal("1;2;4", Db.NewContext().ItemOptions.Single(o => o.Id == id).OptionIds);
        }

        [Fact]
        public async Task LabelTranslationsMustMatchOptionCount()
        {
            var response = await Admin().PostAsJsonAsync("api/Admin/OptionSets", Body(new (int?, string)[] { (null, "Logo"), (null, "Flag") },
                new Dictionary<string, string> { ["hu"] = "Logó" }));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("invalidTranslations", await Code(response));
        }

        [Fact]
        public async Task LabelWithSemicolonIs400()
        {
            var response = await Admin().PostAsJsonAsync("api/Admin/OptionSets", Body(new (int?, string)[] { (null, "Logo;Flag") }));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task UnknownOptionIdIs400()
        {
            var set = await Create("Logo");
            var id = set.GetProperty("id").GetInt32();

            var response = await Admin().PutAsJsonAsync($"api/Admin/OptionSets/{id}", Body(new (int?, string)[] { (1, "Logo"), (7, "Invented") }));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task DeleteUsedSetIsRefused()
        {
            var set = await Create("Logo");
            var id = set.GetProperty("id").GetInt32();
            var itemType = Db.AddCollectionType("Coins");
            Db.Context.Attributes.Add(new Attribute { CollectionTypeId = itemType.Id, Name = "Motif", DataType = AttributeType.Select, ItemOptionsId = id });
            Db.Context.SaveChanges();

            var refused = await Admin().DeleteAsync($"api/Admin/OptionSets/{id}");
            var unused = (await Create("Other")).GetProperty("id").GetInt32();
            var deleted = await Admin().DeleteAsync($"api/Admin/OptionSets/{unused}");

            Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);
            Assert.Equal("optionSetInUse", await Code(refused));
            Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
            var list = await Json(await Admin().GetAsync("api/Admin/OptionSets"));
            Assert.Contains("Coins › Motif", list.EnumerateArray().Single(s => s.GetProperty("id").GetInt32() == id).GetProperty("usedBy").EnumerateArray().Select(u => u.GetString()));
        }

        [Fact]
        public async Task ChangesAreAudited()
        {
            var id = (await Create("Logo")).GetProperty("id").GetInt32();
            await Admin().PutAsJsonAsync($"api/Admin/OptionSets/{id}", Body(new (int?, string)[] { (1, "Logo"), (null, "Flag") }));
            await Admin().DeleteAsync($"api/Admin/OptionSets/{id}");

            using var fresh = Db.NewContext();
            var actions = fresh.AdminAuditLog.Where(a => a.AdminId == _admin.Id).OrderBy(a => a.CreatedAt).Select(a => a.Action).ToList();
            Assert.Equal(new[] { "optionSet.create", "optionSet.update", "optionSet.delete" }, actions);
        }

        public void Dispose() => _api.Dispose();
    }
}
