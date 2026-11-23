using System.Net.Http.Json;
using System.Text.Json;
using Coffer.DataAccess;
using DotNetEnv;
using Microsoft.EntityFrameworkCore;

namespace Coffer.BusinessLogic.ItemTypes
{
    public sealed record FingerprintRebuild(bool Ok, int Items, int Pending, int Missing, string? Message);

    /// <summary>
    /// After an item type gets a new embedding model, every stored fingerprint of the type (its live items and waiting
    /// caps) is rebuilt with it: vectors of different models are in different spaces and must not be compared.
    /// </summary>
    public interface IFingerprintRebuilder
    {
        Task<FingerprintRebuild> RebuildAsync(int typeId, CancellationToken ct = default);
    }

    public sealed class FingerprintRebuilder : IFingerprintRebuilder
    {
        private readonly CofferDbContext _db;
        private readonly HttpClient _http;

        public FingerprintRebuilder(CofferDbContext db, HttpClient http)
        {
            _db = db;
            _http = http;
        }

        private static string PythonUrl => Env.GetString("FASTAPI_URL") ?? throw new InvalidOperationException("FASTAPI_URL envionmental variable is not set");

        public async Task<FingerprintRebuild> RebuildAsync(int typeId, CancellationToken ct = default)
        {
            var collections = _db.Collections.AsNoTracking().Where(c => c.CollectionTypeId == typeId && c.DeletedAt == null).Select(c => c.Id);
            var items = await _db.Items.AsNoTracking()
                .Where(i => collections.Contains(i.CollectionId) && i.DeletedAt == null && i.Image != "")
                .Select(i => new { id = i.Id, collectionId = i.CollectionId, image = i.Image })
                .ToListAsync(ct);
            var pending = await _db.PendingItems.AsNoTracking()
                .Where(p => collections.Contains(p.CollectionId))
                .Select(p => new { id = p.Id, image = p.Image })
                .ToListAsync(ct);

            try
            {
                // Large collections take a while: one photo at a time on the AI service's CPU.
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
                timeout.CancelAfter(TimeSpan.FromMinutes(30));
                var response = await _http.PostAsJsonAsync($"{PythonUrl}/reembed/{typeId}", new { items, pending }, timeout.Token);
                var body = await response.Content.ReadAsStringAsync(timeout.Token);
                if (!response.IsSuccessStatusCode)
                    return new FingerprintRebuild(false, 0, 0, 0, $"{(int)response.StatusCode}: {body}");
                using var json = JsonDocument.Parse(string.IsNullOrWhiteSpace(body) ? "{}" : body);
                int Count(string name) => json.RootElement.TryGetProperty(name, out var v) && v.TryGetInt32(out var n) ? n : 0;
                return new FingerprintRebuild(true, Count("items"), Count("pending"), Count("missing"), null);
            }
            catch (Exception e) when (e is HttpRequestException or TaskCanceledException or JsonException or InvalidOperationException)
            {
                return new FingerprintRebuild(false, 0, 0, 0, e.Message);
            }
        }
    }
}
