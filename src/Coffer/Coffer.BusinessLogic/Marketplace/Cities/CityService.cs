using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.DataAccess;
using Coffer.Domain.Marketplace;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Coffer.BusinessLogic.Marketplace.Cities
{
    public record CityDto(int Id, string Name, string? Admin1, string CountryCode, double Latitude, double Longitude)
    {
        public static CityDto From(City c) => new(c.Id, c.Name, c.Admin1, c.CountryCode, c.Latitude, c.Longitude);
    }

    public interface ICityService
    {
        Task<IReadOnlyList<CityDto>> SearchAsync(string query);
    }

    public static class GeoMath
    {
        private const double EarthRadiusKm = 6371;

        public static double DistanceKm(double lat1, double lon1, double lat2, double lon2)
        {
            static double Rad(double deg) => deg * Math.PI / 180;
            var dLat = Rad(lat2 - lat1);
            var dLon = Rad(lon2 - lon1);
            var a = Math.Pow(Math.Sin(dLat / 2), 2) + Math.Cos(Rad(lat1)) * Math.Cos(Rad(lat2)) * Math.Pow(Math.Sin(dLon / 2), 2);
            return 2 * EarthRadiusKm * Math.Asin(Math.Min(1, Math.Sqrt(a)));
        }

        /// <summary>Latitude/longitude deltas of a box that contains every point within radiusKm.</summary>
        public static (double dLat, double dLon) BoundingBox(double lat, double radiusKm)
        {
            var dLat = radiusKm / 111.0;
            var cos = Math.Max(0.01, Math.Cos(lat * Math.PI / 180));
            return (dLat, radiusKm / (111.0 * cos));
        }
    }

    /// <summary>
    /// City autocomplete backed by the free Open-Meteo geocoding API (no key). Results are stored in the
    /// cities table so listings can reference them and distances can be computed locally.
    /// Only the typed search text is sent to the API.
    /// </summary>
    public class CityService : ICityService
    {
        private const string Endpoint = "https://geocoding-api.open-meteo.com/v1/search";
        private readonly CofferDbContext _db;
        private readonly HttpClient _http;
        private readonly IMemoryCache _cache;

        public CityService(CofferDbContext db, HttpClient http, IMemoryCache cache)
        {
            _db = db;
            _http = http;
            _cache = cache;
            if (_http.Timeout > TimeSpan.FromSeconds(5)) _http.Timeout = TimeSpan.FromSeconds(5);
        }

        private sealed class ApiResponse
        {
            [JsonPropertyName("results")] public List<ApiCity>? Results { get; set; }
        }

        private sealed class ApiCity
        {
            [JsonPropertyName("id")] public long Id { get; set; }
            [JsonPropertyName("name")] public string Name { get; set; } = "";
            [JsonPropertyName("latitude")] public double Latitude { get; set; }
            [JsonPropertyName("longitude")] public double Longitude { get; set; }
            [JsonPropertyName("country_code")] public string? CountryCode { get; set; }
            [JsonPropertyName("admin1")] public string? Admin1 { get; set; }
        }

        public async Task<IReadOnlyList<CityDto>> SearchAsync(string query)
        {
            var q = (query ?? "").Trim();
            if (q.Length < 2 || q.Length > 60)
                throw MarketplaceException.Validation("citySearchNeeds2To60Characters", "City search needs 2 to 60 characters.");

            var key = "city-search:" + q.ToLowerInvariant();
            if (_cache.TryGetValue(key, out IReadOnlyList<CityDto>? cached) && cached != null)
                return cached;

            List<ApiCity>? found = null;
            try
            {
                var url = $"{Endpoint}?name={Uri.EscapeDataString(q)}&count=10&language=en&format=json";
                var response = await _http.GetAsync(url);
                if (response.IsSuccessStatusCode)
                    found = (await response.Content.ReadFromJsonAsync<ApiResponse>())?.Results ?? new List<ApiCity>();
            }
            catch (Exception e) when (e is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
            {
                Console.WriteLine($"City lookup failed: {e.GetType().Name}");
            }

            if (found == null)
            {
                // API unavailable: fall back to cities we already know (not cached, so the API is retried next time).
                var lower = q.ToLower();
                var stored = await _db.Cities.Where(c => c.Name.ToLower().StartsWith(lower)).OrderBy(c => c.Name).Take(10).ToListAsync();
                return stored.Select(CityDto.From).ToList();
            }

            var result = new List<CityDto>();
            foreach (var api in found.Where(a => !string.IsNullOrWhiteSpace(a.Name)))
            {
                var city = await _db.Cities.FirstOrDefaultAsync(c => c.ExternalId == api.Id);
                if (city == null)
                {
                    city = new City { ExternalId = api.Id };
                    _db.Cities.Add(city);
                }
                city.Name = api.Name;
                city.Admin1 = api.Admin1;
                city.CountryCode = (api.CountryCode ?? "").ToUpperInvariant();
                city.Latitude = api.Latitude;
                city.Longitude = api.Longitude;
                await _db.SaveChangesAsync();
                result.Add(CityDto.From(city));
            }

            _cache.Set(key, (IReadOnlyList<CityDto>)result, TimeSpan.FromHours(1));
            return result;
        }
    }
}
