using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace Coffer.Tests
{
    [Collection("api")]
    public class ItemImageAndTransactionTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private TestDb Db => _api.Db;

        private static string WriteImage(string folder, string fileName)
        {
            var path = Path.Combine(folder, fileName);
            File.WriteAllBytes(path, new byte[] { 0xFF, 0xD8, 0xFF });
            return path;
        }

        [Fact]
        public async Task ItemDelete_WithAbsolutePathAsImage_DoesNotDeleteFilesOutsideImageStore()
        {
            var owner = Db.AddUser("owner");
            var sentinel = Path.Combine(TestEnvironment.Root, $"secret-{Guid.NewGuid()}.env");
            File.WriteAllText(sentinel, "JWT_SECRET=do-not-delete");
            var item = Db.AddItem(Db.AddCollection(owner), image: sentinel);

            await _api.ClientFor(owner).DeleteAsync($"api/Items/{item.Id}");

            Assert.True(File.Exists(sentinel), "file outside the image store was deleted");
        }

        [Fact]
        public async Task ItemDelete_WithTraversalImageName_DoesNotDeleteFilesOutsideImageStore()
        {
            var owner = Db.AddUser("owner");
            var sentinelName = $"secret-{Guid.NewGuid()}.jpg";
            var sentinel = Path.Combine(TestEnvironment.Root, sentinelName);
            File.WriteAllText(sentinel, "x");
            var item = Db.AddItem(Db.AddCollection(owner), image: Path.Combine("..", "..", sentinelName));

            await _api.ClientFor(owner).DeleteAsync($"api/Items/{item.Id}");

            Assert.True(File.Exists(sentinel), "file outside the image store was deleted");
        }

        [Fact]
        public async Task ItemDelete_WithAnotherItemsImageName_DoesNotDeleteTheOtherImage()
        {
            var attacker = Db.AddUser("attacker");
            var victimItem = Db.AddItem(Db.AddCollection(Db.AddUser("victim")));
            var victimImage = WriteImage(TestEnvironment.ItemImages, victimItem.Image);
            var attackerItem = Db.AddItem(Db.AddCollection(attacker), image: victimItem.Image);

            await _api.ClientFor(attacker).DeleteAsync($"api/Items/{attackerItem.Id}");

            Assert.True(File.Exists(victimImage), "another user's image was deleted");
        }

        [Fact]
        public async Task ItemDelete_Succeeds_DeletesRowImageAndEmbedding()
        {
            var owner = Db.AddUser("owner");
            var item = Db.AddItem(Db.AddCollection(owner));
            var image = WriteImage(TestEnvironment.ItemImages, item.Image);

            var response = await _api.ClientFor(owner).DeleteAsync($"api/Items/{item.Id}");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.False(Db.NewContext().Items.Any(i => i.Id == item.Id));
            Assert.False(File.Exists(image));
            Assert.Contains(_api.Python.Calls, c => c.Method == HttpMethod.Delete && c.Path == $"/delete_embeddings/{item.Id}");
        }

        [Fact]
        public async Task ItemDelete_WhenImageFileIsMissing_StillDeletesTheItem()
        {
            var owner = Db.AddUser("owner");
            var item = Db.AddItem(Db.AddCollection(owner));

            var response = await _api.ClientFor(owner).DeleteAsync($"api/Items/{item.Id}");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.False(Db.NewContext().Items.Any(i => i.Id == item.Id));
        }

        [Fact]
        public async Task ItemDelete_WhenPythonReportsError_KeepsRowAndImage()
        {
            var owner = Db.AddUser("owner");
            var item = Db.AddItem(Db.AddCollection(owner));
            var image = WriteImage(TestEnvironment.ItemImages, item.Image);
            _api.Python.Body = "{\"status\":\"error\",\"message\":\"chroma down\"}"; // FastAPI answers 200 on errors

            var response = await _api.ClientFor(owner).DeleteAsync($"api/Items/{item.Id}");

            Assert.False(response.IsSuccessStatusCode);
            Assert.True(Db.NewContext().Items.Any(i => i.Id == item.Id), "item row deleted although embedding delete failed");
            Assert.True(File.Exists(image), "image deleted although transaction rolled back");
        }

        [Fact]
        public async Task ItemUpdate_ToQuantityZero_AlsoDeletesTheEmbedding()
        {
            var owner = Db.AddUser("owner");
            var item = Db.AddItem(Db.AddCollection(owner));
            WriteImage(TestEnvironment.ItemImages, item.Image);
            var body = new { collectionId = item.CollectionId, quantity = 0, image = item.Image, itemAttributes = Array.Empty<object>(), itemTags = Array.Empty<object>() };

            var response = await _api.ClientFor(owner).PutAsJsonAsync($"api/Items/{item.Id}", body);

            Assert.True(response.IsSuccessStatusCode);
            Assert.False(Db.NewContext().Items.Any(i => i.Id == item.Id));
            Assert.Contains(_api.Python.Calls, c => c.Method == HttpMethod.Delete && c.Path == $"/delete_embeddings/{item.Id}");
        }

        [Fact]
        public async Task Upsert_WhenPythonReportsError_RollsBackRowsAndCopiedImages()
        {
            var owner = Db.AddUser("owner");
            var collection = Db.AddCollection(owner);
            var tempId = Guid.NewGuid();
            WriteImage(TestEnvironment.Temp, $"{tempId}.jpg");
            var filesBefore = Directory.GetFiles(TestEnvironment.ItemImages).Length;
            _api.Python.Body = "{\"status\":\"error\",\"message\":\"embedding missing\"}";

            var response = await _api.ClientFor(owner).PostAsJsonAsync("api/Items/Upsert", new[]
            {
                new { id = tempId, item = new { collectionId = collection.Id, quantity = 1, image = "x", itemAttributes = Array.Empty<object>(), itemTags = Array.Empty<object>() } }
            });

            Assert.False(response.IsSuccessStatusCode);
            Assert.False(Db.NewContext().Items.Any(i => i.CollectionId == collection.Id), "item committed although embeddings were not saved");
            Assert.Equal(filesBefore, Directory.GetFiles(TestEnvironment.ItemImages).Length);
        }

        [Fact]
        public async Task CollectionDelete_WhenPythonReportsError_KeepsCollectionAndImages()
        {
            var owner = Db.AddUser("owner");
            var collection = Db.AddCollection(owner);
            var item = Db.AddItem(collection);
            var image = WriteImage(TestEnvironment.ItemImages, item.Image);
            _api.Python.Body = "{\"status\":\"error\"}";

            var response = await _api.ClientFor(owner).DeleteAsync($"api/Collections/{collection.Id}");

            Assert.False(response.IsSuccessStatusCode);
            Assert.True(Db.NewContext().Collections.Any(c => c.Id == collection.Id));
            Assert.True(File.Exists(image));
        }

        [Fact]
        public async Task CollectionDelete_WithMissingItemImage_StillSucceeds()
        {
            var owner = Db.AddUser("owner");
            var collection = Db.AddCollection(owner);
            Db.AddItem(collection); // no image file on disk

            var response = await _api.ClientFor(owner).DeleteAsync($"api/Collections/{collection.Id}");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.False(Db.NewContext().Collections.Any(c => c.Id == collection.Id));
        }

        public void Dispose() => _api.Dispose();
    }

    [Collection("api")]
    public class DataExposureTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private TestDb Db => _api.Db;

        private static JsonElement Parse(string json) => JsonDocument.Parse(json).RootElement;

        [Fact]
        public async Task PrivateNote_IsHidden_FromOtherUsers()
        {
            var owner = Db.AddUser("owner");
            var item = Db.AddItem(Db.AddCollection(owner), privateNote: "bought for 500 EUR, hidden in safe");

            var other = Parse(await _api.ClientFor(Db.AddUser("other")).GetStringAsync($"api/Items/{item.Id}"));
            var own = Parse(await _api.ClientFor(owner).GetStringAsync($"api/Items/{item.Id}"));

            Assert.Equal(JsonValueKind.Null, other.GetProperty("privateNote").ValueKind);
            Assert.Equal("bought for 500 EUR, hidden in safe", own.GetProperty("privateNote").GetString());
        }

        [Fact]
        public async Task PrivateNote_IsHidden_InItemLists()
        {
            var owner = Db.AddUser("owner");
            Db.AddItem(Db.AddCollection(owner), privateNote: "secret note");

            var json = await _api.ClientFor(Db.AddUser("other")).GetStringAsync("api/Items");

            Assert.DoesNotContain("secret note", json);
        }

        [Fact]
        public async Task OtherUsersEmailAndProviderId_AreHidden()
        {
            var victim = Db.AddUser("victim");

            var json = await _api.ClientFor(Db.AddUser("other")).GetStringAsync($"api/Users/{victim.Id}");

            Assert.DoesNotContain("victim@example.com", json);
            Assert.DoesNotContain("sub-victim", json);
        }

        [Fact]
        public async Task CurrentUser_StillSeesOwnEmail()
        {
            var me = Db.AddUser("me");

            var json = await _api.ClientFor(me).GetStringAsync("api/auth/currentUser");

            Assert.Contains("me@example.com", json);
        }

        [Theory]
        [InlineData("api/Items?filter=PrivateNote.StartsWith(\"a\")")]
        [InlineData("api/Users?filter=Email.StartsWith(\"a\")")]
        [InlineData("api/Users?filter=ProviderUserId == \"x\"")]
        [InlineData("api/Collections?filter=User.Email.Contains(\"@\")")]
        [InlineData("api/Users?orderBy=Email")]
        public async Task DynamicFilter_OnHiddenFields_IsRejected(string url)
        {
            Db.AddItem(Db.AddCollection(Db.AddUser("victim")), privateNote: "a secret");

            var response = await _api.ClientFor(Db.AddUser("other")).GetAsync(url);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task DynamicFilter_OnNormalFields_StillWorks()
        {
            var owner = Db.AddUser("owner");
            Db.AddCollection(owner);

            var response = await _api.ClientFor(owner).GetAsync($"api/Collections?filter=userId == \"{owner.Id}\"&orderBy=name asc");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        public void Dispose() => _api.Dispose();
    }

    [Collection("api")]
    public class DebugEndpointTests : IDisposable
    {
        private readonly ApiFactory _api = new() { Environment = "Production" };

        [Fact]
        public async Task ImageCheckTestEndpoint_IsNotAvailable_InProduction()
        {
            var user = _api.Db.AddUser("user");
            using var form = new MultipartFormDataContent();
            var file = new ByteArrayContent(new byte[] { 1, 2, 3 });
            file.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/jpeg");
            form.Add(file, "file", "a.jpg");

            var response = await _api.ClientFor(user).PostAsync("api/Collections/ImageCheck/Test", form);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Empty(_api.Python.Calls);
        }

        public void Dispose() => _api.Dispose();
    }
}
