using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Coffer.BusinessLogic.Moderation;
using Coffer.BusinessLogic.Pending;
using Coffer.Domain.Entities;
using Microsoft.Extensions.DependencyInjection;
using Attribute = Coffer.Domain.Entities.Attribute;

namespace Coffer.Tests.ItemTypes
{
    /// <summary>Icons, models and the publish switch through the admin API; unpublishing deletes nothing.</summary>
    [Collection("api")]
    public class PublishingTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private TestDb Db => _api.Db;
        private readonly Coffer.Domain.Moderation.ManagerAdmin _admin;

        public PublishingTests()
        {
            _api.Overrides = services => services.AddSingleton(ManagerAdminConfig.Parse("[\"1001\"]"));
            _admin = Db.AddManagerAdmin("1001");
        }

        private HttpClient Admin() => _api.ManagerClientFor(_admin);

        private static async Task<JsonElement> Json(HttpResponseMessage response) =>
            JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

        private static async Task<string> Code(HttpResponseMessage response) => (await Json(response)).GetProperty("code").GetString()!;

        /// <summary>
        /// Random large ids: every test has its own database (ids restart at 1), but the icon and model folders are shared
        /// by the whole test run.
        /// </summary>
        private CollectionTypeProvided NewType(bool published = false)
        {
            var type = new CollectionTypeProvided($"Type {Guid.NewGuid():N}", "desc", "#FFFFFF", "") // like a new admin-created type: no icon yet
            {
                Id = Random.Shared.Next(100_000, 2_000_000_000),
                Published = published,
            };
            Db.Context.CollectionTypes.Add(type);
            Db.Context.SaveChanges();
            return type;
        }

        private void AddPrimary(CollectionTypeProvided type)
        {
            Db.Context.Attributes.Add(new Attribute { CollectionTypeId = type.Id, Name = "Country", Primary = true, Required = true });
            Db.Context.SaveChanges();
        }

        private static MultipartFormDataContent Form(params (string Field, byte[] Bytes, string Name)[] files)
        {
            var form = new MultipartFormDataContent();
            foreach (var (field, bytes, name) in files)
            {
                var part = new ByteArrayContent(bytes);
                part.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
                form.Add(part, field, name);
            }
            return form;
        }

        private Task<HttpResponseMessage> UploadIcon(int typeId) =>
            Admin().PostAsync($"api/Admin/ItemTypes/{typeId}/Icon", Form(("file", ItemTypeFilesTests.Jpeg(), "icon.jpg")));

        private Task<HttpResponseMessage> UploadModels(int typeId)
        {
            var form = Form(("detection", ItemTypeFilesTests.Model(), "det.pt"), ("embedding", ItemTypeFilesTests.Model(), "emb.pt"));
            form.Add(new StringContent("60"), "classCount");
            return Admin().PostAsync($"api/Admin/ItemTypes/{typeId}/Models", form);
        }

        private Task<HttpResponseMessage> Publish(int typeId, bool published) =>
            Admin().PostAsJsonAsync($"api/Admin/ItemTypes/{typeId}/Publish", new { published });

        [Fact]
        public async Task PublishNeedsModelsPrimaryAndIcon()
        {
            var noModels = NewType();
            AddPrimary(noModels);
            await UploadIcon(noModels.Id);
            var noPrimary = NewType();
            await UploadIcon(noPrimary.Id);
            await UploadModels(noPrimary.Id);
            var noIcon = NewType();
            AddPrimary(noIcon);
            await UploadModels(noIcon.Id);

            Assert.Equal("itemTypeNeedsModels", await Code(await Publish(noModels.Id, true)));
            Assert.Equal("itemTypeNeedsPrimaryAttribute", await Code(await Publish(noPrimary.Id, true)));
            var refused = await Publish(noIcon.Id, true);
            Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);
            Assert.Equal("itemTypeNeedsIcon", await Code(refused));
            using var fresh = Db.NewContext();
            Assert.False(fresh.CollectionTypes.Where(t => t.Id == noModels.Id || t.Id == noPrimary.Id || t.Id == noIcon.Id).Any(t => t.Published));
        }

        [Fact]
        public async Task PublishThenUnpublishFreely()
        {
            var type = NewType();
            AddPrimary(type);
            await UploadIcon(type.Id);
            await UploadModels(type.Id);

            var published = await Publish(type.Id, true);
            var hidden = await Publish(type.Id, false);
            var again = await Publish(type.Id, true);

            Assert.True((await Json(published)).GetProperty("published").GetBoolean());
            Assert.False((await Json(hidden)).GetProperty("published").GetBoolean());
            Assert.True((await Json(again)).GetProperty("published").GetBoolean());
        }

        [Fact]
        public async Task UnpublishDeletesNothing()
        {
            var type = NewType();
            AddPrimary(type);
            await UploadIcon(type.Id);
            await UploadModels(type.Id);
            await Publish(type.Id, true);
            var collection = Db.AddCollection(Db.AddUser("me"), type.Id, "Coins");
            var item = Db.AddItem(collection);

            var response = await Publish(type.Id, false);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            using var fresh = Db.NewContext();
            Assert.True(fresh.Collections.Any(c => c.Id == collection.Id && c.DeletedAt == null));
            Assert.True(fresh.Items.Any(i => i.Id == item.Id && i.DeletedAt == null));
            Assert.Equal(1, fresh.Attributes.Count(a => a.CollectionTypeId == type.Id));
            var stored = fresh.CollectionTypes.Single(t => t.Id == type.Id);
            Assert.NotNull(stored.UnpublishedAt);
            Assert.True(File.Exists(Path.Combine(TestEnvironment.Icons, stored.Icon)));
            Assert.True(File.Exists(Path.Combine(TestEnvironment.Models, $"{type.Id}_detection.pt")));
        }

        private PendingItem Waiting(CollectionProvided collection, DateTime createdAt)
        {
            var row = new PendingItem { Id = Guid.NewGuid(), UserId = collection.UserId, CollectionId = collection.Id, Quantity = 1, Image = "x.jpg", CreatedAt = createdAt };
            Db.Context.PendingItems.Add(row);
            Db.Context.SaveChanges();
            return row;
        }

        [Fact]
        public async Task SweepSkipsHiddenTypes()
        {
            var me = Db.AddUser("me");
            var hidden = Waiting(Db.AddCollection(me, NewType(published: false).Id, "Hidden"), DateTime.UtcNow.AddDays(-40));
            var shown = Waiting(Db.AddCollection(me, NewType(published: true).Id, "Shown"), DateTime.UtcNow.AddDays(-40));

            using (var scope = _api.Services.CreateScope())
                await scope.ServiceProvider.GetRequiredService<IPendingItemService>().PurgeExpiredAsync(DateTime.UtcNow);

            using var fresh = Db.NewContext();
            Assert.True(fresh.PendingItems.Any(p => p.Id == hidden.Id));
            Assert.False(fresh.PendingItems.Any(p => p.Id == shown.Id));
        }

        [Fact]
        public async Task RepublishShiftsWaitingClock()
        {
            var type = NewType();
            AddPrimary(type);
            await UploadIcon(type.Id);
            await UploadModels(type.Id);
            var created = DateTime.UtcNow.AddDays(-25);
            var waiting = Waiting(Db.AddCollection(Db.AddUser("me"), type.Id, "Coins"), created);
            var stored = Db.Context.CollectionTypes.Single(t => t.Id == type.Id);
            stored.UnpublishedAt = DateTime.UtcNow.AddDays(-10);
            Db.Context.SaveChanges();

            await Publish(type.Id, true);

            using var fresh = Db.NewContext();
            var shifted = fresh.PendingItems.Single(p => p.Id == waiting.Id).CreatedAt;
            Assert.InRange((shifted - created).TotalDays, 9.99, 10.01);
            Assert.Null(fresh.CollectionTypes.Single(t => t.Id == type.Id).UnpublishedAt);
        }

        [Fact]
        public async Task UploadsAndPublishAreAudited()
        {
            var type = NewType();
            AddPrimary(type);
            await UploadIcon(type.Id);
            await UploadModels(type.Id);
            await Publish(type.Id, true);
            await Publish(type.Id, false);

            using var fresh = Db.NewContext();
            var audit = fresh.AdminAuditLog.Where(a => a.AdminId == _admin.Id).OrderBy(a => a.CreatedAt).ToList();
            Assert.Equal(new[] { "itemType.icon", "itemType.models", "itemType.fingerprints", "itemType.publish", "itemType.unpublish" }, audit.Select(a => a.Action));
            Assert.Matches("\"detectionSha256\":\"[0-9a-f]{64}\"", audit[1].Details);
        }

        [Fact]
        public async Task PublicIconEndpointServesStoredIcon()
        {
            var type = NewType();
            var icon = (await Json(await UploadIcon(type.Id))).GetProperty("icon").GetString();

            var ok = await _api.ClientFor(null).GetAsync($"api/CollectionTypes/Icon/{icon}");
            var bad = await _api.ClientFor(null).GetAsync("api/CollectionTypes/Icon/..%2F..%2Fappsettings.json");

            Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
            Assert.Equal("image/png", ok.Content.Headers.ContentType?.MediaType);
            Assert.Contains("nosniff", ok.Headers.GetValues("X-Content-Type-Options"));
            Assert.Equal(HttpStatusCode.NotFound, bad.StatusCode);
        }

        [Fact]
        public async Task ReplacingIconDeletesTheOldFile()
        {
            var type = NewType();
            var first = (await Json(await UploadIcon(type.Id))).GetProperty("icon").GetString()!;
            await Task.Delay(1100); // names carry the second

            var second = (await Json(await UploadIcon(type.Id))).GetProperty("icon").GetString()!;

            Assert.NotEqual(first, second);
            Assert.False(File.Exists(Path.Combine(TestEnvironment.Icons, first)));
            Assert.True(File.Exists(Path.Combine(TestEnvironment.Icons, second)));
        }

        [Fact]
        public async Task FileRoutesRejectNonAdmins()
        {
            var type = NewType();
            var roleAdmin = Db.AddUser("legacy-admin", Coffer.Domain.Constants.UserRole.Admin);
            var former = Db.AddManagerAdmin("2002", "former");
            var routes = new[] { $"api/Admin/ItemTypes/{type.Id}/Icon", $"api/Admin/ItemTypes/{type.Id}/Models", $"api/Admin/ItemTypes/{type.Id}/Publish" };

            foreach (var url in routes)
            {
                Assert.Equal(HttpStatusCode.Unauthorized, (await _api.ClientFor(null).PostAsync(url, Form(("file", ItemTypeFilesTests.Jpeg(), "a.jpg")))).StatusCode);
                Assert.Equal(HttpStatusCode.Unauthorized, (await _api.ClientFor(roleAdmin).PostAsync(url, Form(("file", ItemTypeFilesTests.Jpeg(), "a.jpg")))).StatusCode);
                Assert.Equal(HttpStatusCode.Forbidden, (await _api.ManagerClientFor(former).PostAsync(url, Form(("file", ItemTypeFilesTests.Jpeg(), "a.jpg")))).StatusCode);
            }

            using var fresh = Db.NewContext();
            Assert.Equal("", fresh.CollectionTypes.Single(t => t.Id == type.Id).Icon);
            Assert.Null(new Coffer.BusinessLogic.ItemTypes.ItemTypeFiles().Detection(type.Id));
        }

        public void Dispose() => _api.Dispose();
    }
}
