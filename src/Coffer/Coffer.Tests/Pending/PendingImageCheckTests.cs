using System.Net;
using System.Text.Json;

namespace Coffer.Tests.Pending
{
    /// <summary>
    /// POST api/Collections/ImageCheck/{id}: every cap the AI finds becomes a pending item, and its crop and
    /// fingerprint are moved at once out of the 10-minute temp folder into AppPaths.Images/pending.
    /// </summary>
    [Collection("api")]
    public class PendingImageCheckTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private TestDb Db => _api.Db;

        private static void WriteTemp(Guid id, bool jpg = true, bool npy = true)
        {
            if (jpg) File.WriteAllBytes(Path.Combine(TestEnvironment.Temp, $"{id}.jpg"), new byte[] { 0xFF, 0xD8, 0xFF });
            if (npy) File.WriteAllBytes(Path.Combine(TestEnvironment.Temp, $"{id}.npy"), new byte[] { 1, 2, 3 });
        }

        private static string Pending(Guid id, string ext) => Path.Combine(TestEnvironment.Pending, $"{id}.{ext}");
        private static string Temp(Guid id, string ext) => Path.Combine(TestEnvironment.Temp, $"{id}.{ext}");

        private void AnswerImageCheck(params object[] detections) =>
            _api.Python.Responder = request => (HttpStatusCode.OK, JsonSerializer.Serialize(new { status = "ok", response = detections }));

        private static MultipartFormDataContent Photo()
        {
            var form = new MultipartFormDataContent();
            var file = new ByteArrayContent(Coffer.Tests.ItemTypes.ItemTypeFilesTests.Jpeg(64, 48));
            file.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/jpeg");
            form.Add(file, "file", "caps.jpg");
            return form;
        }

        [Fact]
        public async Task ImageCheckCreatesPendingItemsAndMovesFiles()
        {
            var owner = Db.AddUser("owner");
            var collection = Db.AddCollection(owner);
            var existing = Db.AddItem(collection);
            Guid a = Guid.NewGuid(), b = Guid.NewGuid();
            WriteTemp(a);
            WriteTemp(b);
            AnswerImageCheck(
                new { id = a, state = "not found", quantity = 2, similars = Array.Empty<Guid>() },
                new { id = b, state = "found", quantity = 1, similars = new[] { existing.Id } });

            var response = await _api.ClientFor(owner).PostAsync($"api/Collections/ImageCheck/{collection.Id}", Photo());

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var result = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
            Assert.Equal(0, result.GetProperty("lost").GetInt32());
            var created = result.GetProperty("created").EnumerateArray().ToDictionary(c => c.GetProperty("id").GetGuid());
            Assert.Equal(2, created.Count);
            Assert.Equal(existing.Id, created[b].GetProperty("similars")[0].GetProperty("id").GetGuid());
            Assert.Equal("found", created[b].GetProperty("state").GetString());

            using var fresh = Db.NewContext();
            var rows = fresh.PendingItems.Where(p => p.CollectionId == collection.Id).ToDictionary(p => p.Id);
            Assert.Equal(2, rows[a].Quantity);
            Assert.Equal(1, rows[b].Quantity);
            Assert.All(rows.Values, r => Assert.Equal(owner.Id, r.UserId));
            foreach (var id in new[] { a, b })
            {
                Assert.True(File.Exists(Pending(id, "jpg")));
                Assert.True(File.Exists(Pending(id, "npy")));
                Assert.False(File.Exists(Temp(id, "jpg")));
                Assert.False(File.Exists(Temp(id, "npy")));
            }
        }

        [Fact]
        public async Task ImageCheckSkipsDetectionsWhoseFilesVanished()
        {
            var owner = Db.AddUser("owner");
            var collection = Db.AddCollection(owner);
            Guid a = Guid.NewGuid(), b = Guid.NewGuid();
            WriteTemp(a);
            WriteTemp(b, npy: false); // half gone: the cap can't be matched or saved later
            AnswerImageCheck(
                new { id = a, state = "not found", quantity = 1, similars = Array.Empty<Guid>() },
                new { id = b, state = "not found", quantity = 1, similars = Array.Empty<Guid>() });

            var response = await _api.ClientFor(owner).PostAsync($"api/Collections/ImageCheck/{collection.Id}", Photo());

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var result = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
            Assert.Equal(1, result.GetProperty("created").GetArrayLength());
            Assert.Equal(1, result.GetProperty("lost").GetInt32());
            using var fresh = Db.NewContext();
            Assert.Equal(new[] { a }, fresh.PendingItems.Select(p => p.Id).ToArray());
            Assert.False(File.Exists(Pending(b, "jpg"))); // no half-moved leftovers
        }

        [Fact]
        public async Task ImageCheckAiErrorIsAFailureNotNoCaps()
        {
            var owner = Db.AddUser("owner");
            var collection = Db.AddCollection(owner);
            // FastAPI answers 200 with {"status":"error"} when the check itself crashed.
            _api.Python.Responder = request => (HttpStatusCode.OK, "{\"status\":\"error\",\"message\":\"model missing\"}");

            var response = await _api.ClientFor(owner).PostAsync($"api/Collections/ImageCheck/{collection.Id}", Photo());

            Assert.False(response.IsSuccessStatusCode); // the app shows "Couldn't be checked" + Retry, not "No caps found"
            using var fresh = Db.NewContext();
            Assert.Empty(fresh.PendingItems);
        }

        [Fact]
        public async Task ImageCheckOnOthersCollectionIsForbidden()
        {
            var owner = Db.AddUser("owner");
            var stranger = Db.AddUser("stranger");
            var collection = Db.AddCollection(owner);
            AnswerImageCheck();

            var response = await _api.ClientFor(stranger).PostAsync($"api/Collections/ImageCheck/{collection.Id}", Photo());

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            using var fresh = Db.NewContext();
            Assert.Empty(fresh.PendingItems);
        }

        public void Dispose() => _api.Dispose();
    }
}
