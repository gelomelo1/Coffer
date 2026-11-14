using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Coffer.Domain.Entities;
using Coffer.Domain.Marketplace;

namespace Coffer.Tests.Marketplace
{
    [Collection("api")]
    public class ListingApiTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private TestDb Db => _api.Db;
        private static string ListingFolder => Path.Combine(TestEnvironment.Root, "images", "listings");

        private (int typeId, int cityId) Seed()
        {
            var type = new CollectionTypeProvided("Stamps", "d", "#19283f", "stamp");
            var city = new City { ExternalId = 1, Name = "Budapest", CountryCode = "HU", Latitude = 47.5, Longitude = 19.04 };
            Db.Context.CollectionTypes.Add(type);
            Db.Context.Cities.Add(city);
            Db.Context.SaveChanges();
            return (type.Id, city.Id);
        }

        private static MultipartFormDataContent Form(int typeId, int cityId, params (string name, string type, byte[] bytes)[] files)
        {
            var payload = JsonSerializer.Serialize(new
            {
                kind = "sell", collectionTypeId = typeId, title = "Stamp album", priceCents = 1500, condition = "like_new",
                cityId, allowsLocalPickup = true, allowsShipping = true, privateSellerDeclared = true,
                lines = new[] { new { name = "Stamp", quantity = 40 } },
            });
            var form = new MultipartFormDataContent { { new StringContent(payload), "payload" } };
            foreach (var (name, type, bytes) in files)
            {
                var content = new ByteArrayContent(bytes);
                content.Headers.ContentType = new MediaTypeHeaderValue(type);
                form.Add(content, "images", name);
            }
            return form;
        }

        private static (string, string, byte[]) Jpeg => ("a.jpg", "image/jpeg", TestImages.Jpeg);

        private int ListingFileCount() => Directory.Exists(ListingFolder) ? Directory.GetFiles(ListingFolder).Length : 0;

        [Fact]
        public async Task Anonymous_401()
        {
            var (typeId, cityId) = Seed();
            var response = await _api.ClientFor(null).PostAsync("api/Listings", Form(typeId, cityId, Jpeg));
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await _api.ClientFor(null).GetAsync("api/Listings")).StatusCode);
        }

        [Fact]
        public async Task Create_ReturnsSnakeCaseEnums_AndOwnerIsCaller()
        {
            var (typeId, cityId) = Seed();
            var user = Db.AddUser("seller");

            var response = await _api.ClientFor(user).PostAsync("api/Listings", Form(typeId, cityId, Jpeg));
            var json = await response.Content.ReadAsStringAsync();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Contains("\"kind\":\"sell\"", json);
            Assert.Contains("\"condition\":\"like_new\"", json);
            Assert.Contains("\"status\":\"active\"", json);
            Assert.Equal(user.Id, Db.NewContext().Listings.Single().OwnerId);
        }

        [Fact]
        public async Task Create_RejectsNonImageFile()
        {
            var (typeId, cityId) = Seed();
            var before = ListingFileCount();

            var response = await _api.ClientFor(Db.AddUser("seller")).PostAsync("api/Listings",
                Form(typeId, cityId, ("notes.txt", "text/plain", new byte[] { 1, 2, 3 })));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Empty(Db.NewContext().Listings);
            Assert.Equal(before, ListingFileCount());
        }

        [Fact]
        public async Task Create_MoreThanSixImages_400()
        {
            var (typeId, cityId) = Seed();
            var response = await _api.ClientFor(Db.AddUser("seller")).PostAsync("api/Listings",
                Form(typeId, cityId, Enumerable.Repeat(Jpeg, 7).ToArray()));
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task Create_MalformedPayload_400()
        {
            var form = new MultipartFormDataContent { { new StringContent("{not json"), "payload" } };
            var response = await _api.ClientFor(Db.AddUser("seller")).PostAsync("api/Listings", form);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task Search_AcceptsSnakeCaseFilters()
        {
            var (typeId, cityId) = Seed();
            await _api.ClientFor(Db.AddUser("seller")).PostAsync("api/Listings", Form(typeId, cityId, Jpeg));

            var response = await _api.ClientFor(Db.AddUser("buyer"))
                .GetAsync($"api/Listings?kind=sell&delivery=local_pickup&condition=like_new&cityId={cityId}&radiusKm=10&sort=nearest");
            var json = await response.Content.ReadAsStringAsync();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Contains("Stamp album", json);
            Assert.Equal(HttpStatusCode.BadRequest, (await _api.ClientFor(Db.AddUser("x")).GetAsync("api/Listings?delivery=teleport")).StatusCode);
        }

        public void Dispose() => _api.Dispose();
    }
}
