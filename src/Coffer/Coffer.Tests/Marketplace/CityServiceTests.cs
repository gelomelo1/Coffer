using System.Net;
using System.Text;
using Coffer.BusinessLogic.Marketplace.Cities;
using Coffer.BusinessLogic.Marketplace.Common;
using Microsoft.Extensions.Caching.Memory;

namespace Coffer.Tests.Marketplace
{
    public sealed class StubHttpHandler : HttpMessageHandler
    {
        public List<Uri> Requests { get; } = new();
        public HttpStatusCode Status { get; set; } = HttpStatusCode.OK;
        public string Body { get; set; } = "{}";

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests.Add(request.RequestUri!);
            return Task.FromResult(new HttpResponseMessage(Status) { Content = new StringContent(Body, Encoding.UTF8, "application/json") });
        }
    }

    public class CityServiceTests : MarketplaceTestBase
    {
        private const string BudapestJson =
            "{\"results\":[{\"id\":3054643,\"name\":\"Budapest\",\"latitude\":47.49801,\"longitude\":19.03991,\"country_code\":\"HU\",\"admin1\":\"Budapest\"}]}";

        private readonly StubHttpHandler _http = new() { Body = BudapestJson };

        private CityService Sut() => new(Db.Context, new HttpClient(_http), new MemoryCache(new MemoryCacheOptions()));

        [Fact]
        public async Task Search_CallsOpenMeteoAndUpsertsCities()
        {
            var result = await Sut().SearchAsync("Buda");
            await Sut().SearchAsync("Budap"); // fresh cache, second call → same city must not be duplicated

            var uri = _http.Requests[0];
            Assert.Equal("geocoding-api.open-meteo.com", uri.Host);
            Assert.Equal("/v1/search", uri.AbsolutePath);
            Assert.Contains("name=Buda", uri.Query);
            Assert.Contains("count=10", uri.Query);
            Assert.Contains("language=en", uri.Query);

            var city = Assert.Single(result);
            Assert.Equal("Budapest", city.Name);
            Assert.Equal("HU", city.CountryCode);
            Assert.Equal(47.49801, city.Latitude, 5);
            Assert.True(city.Id > 0);
            Assert.Single(Db.NewContext().Cities);
        }

        [Fact]
        public async Task Search_SameQueryTwice_UsesCache()
        {
            var sut = Sut();
            await sut.SearchAsync("Buda");
            await sut.SearchAsync(" buda ");

            Assert.Single(_http.Requests);
        }

        [Fact]
        public async Task Search_ApiFailure_ReturnsStoredMatches()
        {
            GetOrAddCity(3054643, "Budapest", 47.49801, 19.03991);
            GetOrAddCity(721472, "Debrecen", 47.53333, 21.63333);
            _http.Status = HttpStatusCode.InternalServerError;

            var result = await Sut().SearchAsync("Bud");

            Assert.Equal("Budapest", Assert.Single(result).Name);
        }

        [Theory]
        [InlineData("a")]
        [InlineData("  ")]
        public async Task Search_TooShortQuery_Validation(string q)
        {
            var ex = await Assert.ThrowsAsync<MarketplaceException>(() => Sut().SearchAsync(q));
            Assert.Equal(MarketplaceError.Validation, ex.Error);
        }

        [Fact]
        public void DistanceKm_BudapestToDebrecen_About194()
        {
            var km = GeoMath.DistanceKm(47.49801, 19.03991, 47.53333, 21.63333);
            Assert.InRange(km, 190, 198);
        }
    }
}
