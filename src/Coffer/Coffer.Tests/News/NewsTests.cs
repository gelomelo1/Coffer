using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Coffer.BusinessLogic.Moderation;
using Coffer.Domain.Constants;
using Coffer.Tests.ItemTypes;
using Microsoft.Extensions.DependencyInjection;

namespace Coffer.Tests.News
{
    /// <summary>News posts: written as drafts in the Manager, published to the app; images in the news store.</summary>
    [Collection("api")]
    public class NewsTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private TestDb Db => _api.Db;
        private readonly Coffer.Domain.Moderation.ManagerAdmin _admin;

        public NewsTests()
        {
            _api.Overrides = services => services.AddSingleton(ManagerAdminConfig.Parse("[\"1001\"]"));
            _admin = Db.AddManagerAdmin("1001");
        }

        private HttpClient Admin() => _api.ManagerClientFor(_admin);
        private HttpClient Reader() => _api.ClientFor(Db.AddUser("reader" + Guid.NewGuid().ToString("N")[..6]));

        private static async Task<JsonElement> Json(HttpResponseMessage response) =>
            JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

        private static async Task<string> Code(HttpResponseMessage response) => (await Json(response)).GetProperty("code").GetString()!;

        private static object Body(string title = "Coffer 2.0 is here", string? hero = null, string content = "# Hello\n\nWe added **news**.") =>
            new { title, heroImage = hero, content };

        private async Task<Guid> Create(string title = "Coffer 2.0 is here", string? hero = null, string content = "# Hello\n\nWe added **news**.")
        {
            var response = await Admin().PostAsJsonAsync("api/Admin/News", Body(title, hero, content));
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return (await Json(response)).GetProperty("id").GetGuid();
        }

        private Task<HttpResponseMessage> Publish(Guid id, bool published = true) =>
            Admin().PostAsJsonAsync($"api/Admin/News/{id}/Publish", new { published });

        private async Task<string> Upload(byte[]? bytes = null, string name = "photo.jpg")
        {
            var form = new MultipartFormDataContent();
            var part = new ByteArrayContent(bytes ?? ItemTypeFilesTests.Jpeg(64, 32));
            part.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
            form.Add(part, "file", name);
            var response = await Admin().PostAsync("api/Admin/News/Images", form);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return (await Json(response)).GetProperty("fileName").GetString()!;
        }

        private static string StoreFile(string name) => Path.Combine(TestEnvironment.Root, "data", "images", "news", name);

        [Fact]
        public async Task CreateStartsAsDraft()
        {
            var id = await Create();

            var post = await Json(await Admin().GetAsync($"api/Admin/News/{id}"));
            Assert.Equal("draft", post.GetProperty("status").GetString());
            Assert.Equal(JsonValueKind.Null, post.GetProperty("publishedAt").ValueKind);
            Assert.Equal("# Hello\n\nWe added **news**.", post.GetProperty("content").GetString());
        }

        [Fact]
        public async Task TitleAndContentAreValidated()
        {
            foreach (var body in new[] { Body(title: " "), Body(title: new string('a', 121)), Body(content: new string('x', 50_001)) })
                Assert.Equal(HttpStatusCode.BadRequest, (await Admin().PostAsJsonAsync("api/Admin/News", body)).StatusCode);
        }

        [Fact]
        public async Task UnknownImageNamesAreRejected()
        {
            var badHero = await Admin().PostAsJsonAsync("api/Admin/News", Body(hero: "0123456789abcdef0123456789abcdef.jpg"));
            var badContent = await Admin().PostAsJsonAsync("api/Admin/News", Body(content: "![x](coffer-image:fedcba9876543210fedcba9876543210.jpg)"));
            var stored = await Upload();
            var good = await Admin().PostAsJsonAsync("api/Admin/News", Body(hero: stored, content: $"![x](coffer-image:{stored})"));

            Assert.Equal("newsImageNotFound", await Code(badHero));
            Assert.Equal("newsImageNotFound", await Code(badContent));
            Assert.Equal(HttpStatusCode.OK, good.StatusCode);
        }

        [Fact]
        public async Task PublishSetsTheDateAndListsTheCard()
        {
            var hero = await Upload();
            var id = await Create(hero: hero);

            var published = await Json(await Publish(id));
            var list = await Json(await Reader().GetAsync("api/News"));
            var post = await Json(await Reader().GetAsync($"api/News/{id}"));

            Assert.Equal("published", published.GetProperty("status").GetString());
            var card = list.GetProperty("items")[0];
            Assert.Equal(id, card.GetProperty("id").GetGuid());
            Assert.Equal(hero, card.GetProperty("heroImage").GetString());
            Assert.False(card.TryGetProperty("content", out _), "cards don't carry the content");
            Assert.Equal("# Hello\n\nWe added **news**.", post.GetProperty("content").GetString());
            Assert.Equal(JsonValueKind.Null, post.GetProperty("editedAt").ValueKind);
        }

        [Fact]
        public async Task RepublishKeepsTheOriginalDate()
        {
            var id = await Create();
            await Admin().PutAsJsonAsync($"api/Admin/News/{id}", Body(title: "Draft edit"));
            var first = (await Json(await Publish(id))).GetProperty("publishedAt").GetDateTime();
            Assert.Equal(JsonValueKind.Null, (await Json(await Admin().GetAsync($"api/Admin/News/{id}"))).GetProperty("editedAt").ValueKind);
            await Task.Delay(20);

            await Publish(id, false);
            var again = (await Json(await Publish(id))).GetProperty("publishedAt").GetDateTime();
            var edited = await Json(await Admin().PutAsJsonAsync($"api/Admin/News/{id}", Body(title: "Fixed a typo")));

            Assert.Equal(first, again);
            Assert.NotEqual(JsonValueKind.Null, edited.GetProperty("editedAt").ValueKind);
            Assert.Equal(first, edited.GetProperty("publishedAt").GetDateTime());
        }

        [Fact]
        public async Task PublishedAreNewestFirst()
        {
            var older = await Create("Older");
            await Publish(older);
            await Task.Delay(20);
            var newer = await Create("Newer");
            await Publish(newer);

            var titles = (await Json(await Reader().GetAsync("api/News"))).GetProperty("items").EnumerateArray().Select(c => c.GetProperty("title").GetString());

            Assert.Equal(new[] { "Newer", "Older" }, titles);
        }

        [Fact]
        public async Task DraftsAreInvisibleToTheApp()
        {
            var draft = await Create("Secret plans");
            var unpublished = await Create("Pulled back");
            await Publish(unpublished);
            await Publish(unpublished, false);

            var list = await Reader().GetStringAsync("api/News");

            Assert.DoesNotContain("Secret plans", list);
            Assert.DoesNotContain("Pulled back", list);
            foreach (var id in new[] { draft, unpublished, Guid.NewGuid() })
            {
                var response = await Reader().GetAsync($"api/News/{id}");
                Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
                Assert.Equal("newsNotFound", await Code(response));
            }
        }

        [Fact]
        public async Task DeletingAPostKeepsSharedImages()
        {
            var shared = await Upload();
            var own = await Upload();
            var hero = await Upload();
            var keep = await Create("Keep", content: $"![a](coffer-image:{shared})");
            var gone = await Create("Gone", hero: hero, content: $"![a](coffer-image:{shared}) ![b](coffer-image:{own})");

            var response = await Admin().DeleteAsync($"api/Admin/News/{gone}");

            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
            Assert.True(File.Exists(StoreFile(shared)));
            Assert.False(File.Exists(StoreFile(own)));
            Assert.False(File.Exists(StoreFile(hero)));
            Assert.Equal(HttpStatusCode.OK, (await Admin().GetAsync($"api/Admin/News/{keep}")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await Admin().GetAsync($"api/Admin/News/{gone}")).StatusCode);
        }

        /// <summary>Makes a stored image look uploaded <paramref name="days"/> days ago.</summary>
        private static void Age(string name, int days) => File.SetLastWriteTimeUtc(StoreFile(name), DateTime.UtcNow.AddDays(-days));

        [Fact]
        public async Task UnusedUploadsAreRemovedAfterAWeek()
        {
            var abandoned = await Upload();
            var recent = await Upload();
            Age(abandoned, 8);
            Age(recent, 6);

            await Create("Any save tidies the store");

            Assert.False(File.Exists(StoreFile(abandoned)));
            Assert.True(File.Exists(StoreFile(recent)));
        }

        [Fact]
        public async Task AReplacedBannerIsRemovedOnceOld()
        {
            var first = await Upload();
            var second = await Upload();
            var id = await Create("Banner swap", hero: first);
            Age(first, 8);

            var response = await Admin().PutAsJsonAsync($"api/Admin/News/{id}", Body(title: "Banner swap", hero: second));

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.False(File.Exists(StoreFile(first)));
            Assert.True(File.Exists(StoreFile(second)));
        }

        [Fact]
        public async Task ImagesInUseAreNeverRemoved()
        {
            var hero = await Upload();
            var inline = await Upload();
            var inDraft = await Upload();
            var id = await Create("Published one", hero: hero, content: $"![x](coffer-image:{inline})");
            await Publish(id);
            await Create("Someone's draft", content: $"![y](coffer-image:{inDraft})");
            foreach (var name in new[] { hero, inline, inDraft }) Age(name, 30);

            await Admin().PutAsJsonAsync($"api/Admin/News/{id}", Body(title: "Published one, renamed", hero: hero, content: $"![x](coffer-image:{inline})"));
            await Upload();

            Assert.True(File.Exists(StoreFile(hero)));
            Assert.True(File.Exists(StoreFile(inline)));
            Assert.True(File.Exists(StoreFile(inDraft)));
        }

        [Fact]
        public async Task ImageUploadIsReencodedAndServed()
        {
            var name = await Upload(ItemTypeFilesTests.Jpeg(2400, 1200));

            Assert.Matches("^[0-9a-f]{32}\\.jpg$", name);
            using (var image = SixLabors.ImageSharp.Image.Load(StoreFile(name)))
                Assert.Equal(1600, image.Width);
            var served = await _api.ClientFor(null).GetAsync($"api/News/Image/{name}");
            Assert.Equal(HttpStatusCode.OK, served.StatusCode);
            Assert.Equal("image/jpeg", served.Content.Headers.ContentType?.MediaType);
            Assert.Contains("nosniff", served.Headers.GetValues("X-Content-Type-Options"));

            var form = new MultipartFormDataContent { { new ByteArrayContent("<svg onload=alert(1)>"u8.ToArray()), "file", "x.jpg" } };
            var bad = await Admin().PostAsync("api/Admin/News/Images", form);
            Assert.Equal("invalidImage", await Code(bad));
            Assert.Equal(HttpStatusCode.NotFound, (await _api.ClientFor(null).GetAsync("api/News/Image/..%2F..%2Fappsettings.json")).StatusCode);
        }

        [Fact]
        public async Task ChangesAreAudited()
        {
            var image = await Upload();
            var id = await Create();
            await Admin().PutAsJsonAsync($"api/Admin/News/{id}", Body(title: "Renamed"));
            await Publish(id);
            await Publish(id, false);
            await Admin().DeleteAsync($"api/Admin/News/{id}");

            using var fresh = Db.NewContext();
            var actions = fresh.AdminAuditLog.Where(a => a.AdminId == _admin.Id).OrderBy(a => a.CreatedAt).Select(a => a.Action).ToList();
            Assert.Equal(new[] { "news.image", "news.create", "news.update", "news.publish", "news.unpublish", "news.delete" }, actions);
            Assert.Contains(image, fresh.AdminAuditLog.First(a => a.Action == "news.image").Details);
        }

        [Fact]
        public async Task EveryNewsAdminRouteRejectsNonAdmins()
        {
            var id = await Create("Untouched");
            var roleAdmin = Db.AddUser("legacy-admin", UserRole.Admin);
            var former = Db.AddManagerAdmin("2002", "former");
            var routes = new (HttpMethod Method, string Url)[]
            {
                (HttpMethod.Get, "api/Admin/News"), (HttpMethod.Get, $"api/Admin/News/{id}"), (HttpMethod.Post, "api/Admin/News"),
                (HttpMethod.Put, $"api/Admin/News/{id}"), (HttpMethod.Delete, $"api/Admin/News/{id}"),
                (HttpMethod.Post, $"api/Admin/News/{id}/Publish"), (HttpMethod.Post, "api/Admin/News/Images"),
            };

            foreach (var (method, url) in routes)
            {
                HttpRequestMessage Request() => new(method, url)
                {
                    Content = method == HttpMethod.Get || method == HttpMethod.Delete ? null
                        : url.EndsWith("/Images") ? new MultipartFormDataContent { { new ByteArrayContent(new byte[] { 1, 2, 3 }), "file", "x.png" } }
                        : JsonContent.Create(Body(title: "Hacked")),
                };
                Assert.Equal(HttpStatusCode.Unauthorized, (await _api.ClientFor(null).SendAsync(Request())).StatusCode);
                Assert.Equal(HttpStatusCode.Unauthorized, (await _api.ClientFor(roleAdmin).SendAsync(Request())).StatusCode);
                Assert.Equal(HttpStatusCode.Forbidden, (await _api.ManagerClientFor(former).SendAsync(Request())).StatusCode);
            }

            var post = await Json(await Admin().GetAsync($"api/Admin/News/{id}"));
            Assert.Equal("Untouched", post.GetProperty("title").GetString());
            Assert.Equal("draft", post.GetProperty("status").GetString());
        }

        [Fact]
        public async Task AppNewsNeedsSignIn()
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await _api.ClientFor(null).GetAsync("api/News")).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await _api.ClientFor(null).GetAsync($"api/News/{Guid.NewGuid()}")).StatusCode);
        }

        public void Dispose() => _api.Dispose();
    }
}
