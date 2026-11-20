using System.Net.Http.Headers;
using System.Text.Json;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.DataAccess;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using DotNetEnv;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Coffer.BusinessLogic.Pending
{
    /// <summary>A cap waiting for review, with its matches in the collection as it is now.</summary>
    public sealed record PendingItemDto(Guid Id, Guid CollectionId, int Quantity, DateTime CreatedAt, string State, List<ItemProvided> Similars);

    /// <summary>What one photo produced: the new waiting caps, and how many detections were lost (their files had vanished).</summary>
    public sealed record ImageCheckResultDto(List<PendingItemDto> Created, int Lost);

    public interface IPendingItemService
    {
        /// <summary>Runs the AI check on one photo and puts every detected cap on the collection's waiting list.</summary>
        Task<ImageCheckResultDto> CreateFromImageAsync(Guid userId, CollectionProvided collection, IFormFile file);
    }

    public sealed class PendingItemService : IPendingItemService
    {
        private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };

        private readonly CofferDbContext _db;
        private readonly IItemsRepository _items;
        private readonly HttpClient _http;
        private readonly ILogger<PendingItemService> _log;

        public PendingItemService(CofferDbContext db, IItemsRepository items, HttpClient http, ILogger<PendingItemService> log)
        {
            _db = db;
            _items = items;
            _http = http;
            _log = log;
        }

        private static string ImageStore => Env.GetString("IMAGESTORE_PATH") ?? throw new InvalidOperationException("IMAGESTORE_PATH envionmental variable is not set");
        private static string TempFolder => Env.GetString("IMAGECHECK_TEMP_PATH") ?? throw new InvalidOperationException("IMAGECHECK_TEMP_PATH envionmental variable is not set");
        private static string PythonUrl => Env.GetString("FASTAPI_URL") ?? throw new InvalidOperationException("FASTAPI_URL envionmental variable is not set");

        /// <summary>Crops (.jpg) and fingerprints (.npy) of waiting caps, shared with the AI service.</summary>
        public static string PendingFolder => Path.Combine(ImageStore, "pending");

        private sealed record Detection(Guid Id, string State, int Quantity, List<Guid> Similars);
        private sealed record DetectionResponse(string Status, List<Detection>? Response);

        public async Task<ImageCheckResultDto> CreateFromImageAsync(Guid userId, CollectionProvided collection, IFormFile file)
        {
            using var form = new MultipartFormDataContent();
            await using var stream = file.OpenReadStream();
            using var content = new StreamContent(stream);
            content.Headers.ContentType = new MediaTypeHeaderValue(file.ContentType);
            form.Add(content, "file", file.FileName);

            var response = await _http.PostAsync($"{PythonUrl}/image_check/{collection.CollectionTypeId}/{collection.Id}", form);
            response.EnsureSuccessStatusCode();
            var detections = JsonSerializer.Deserialize<DetectionResponse>(await response.Content.ReadAsStringAsync(), Json)?.Response ?? new();

            Directory.CreateDirectory(PendingFolder);
            var now = DateTime.UtcNow;
            var created = new List<(PendingItem Row, Detection Detection)>();
            var lost = 0;
            foreach (var detection in detections)
            {
                // The AI service deletes its temp files after 10 minutes: move them out now, both or neither.
                if (!TryMove(detection.Id))
                {
                    lost++;
                    continue;
                }
                var row = new PendingItem
                {
                    Id = detection.Id,
                    UserId = userId,
                    CollectionId = collection.Id,
                    Quantity = Math.Max(1, detection.Quantity),
                    Image = $"{detection.Id}.jpg",
                    // Newest first: keep the detection order of one photo stable.
                    CreatedAt = now.AddTicks(-created.Count),
                };
                _db.PendingItems.Add(row);
                created.Add((row, detection));
            }
            await _db.SaveChangesAsync();

            var dtos = new List<PendingItemDto>();
            foreach (var (row, detection) in created)
                dtos.Add(new PendingItemDto(row.Id, row.CollectionId, row.Quantity, row.CreatedAt, detection.State, await LiveItemsAsync(detection.Similars)));
            return new ImageCheckResultDto(dtos, lost);
        }

        private bool TryMove(Guid id)
        {
            var jpg = Path.Combine(TempFolder, $"{id}.jpg");
            var npy = Path.Combine(TempFolder, $"{id}.npy");
            if (!File.Exists(jpg) || !File.Exists(npy))
            {
                _log.LogWarning("Detection {Id} lost: its temp files are gone.", id);
                return false;
            }
            try
            {
                File.Move(jpg, Path.Combine(PendingFolder, $"{id}.jpg"), overwrite: true);
                File.Move(npy, Path.Combine(PendingFolder, $"{id}.npy"), overwrite: true);
                return true;
            }
            catch (IOException e)
            {
                _log.LogWarning("Detection {Id} lost while moving: {Error}", id, e.Message);
                DeleteFiles(id);
                return false;
            }
        }

        /// <summary>Removes a waiting cap's crop and fingerprint (missing files are fine).</summary>
        public static void DeleteFiles(Guid id)
        {
            foreach (var ext in new[] { "jpg", "npy" })
            {
                var path = Path.Combine(PendingFolder, $"{id}.{ext}");
                try { if (File.Exists(path)) File.Delete(path); }
                catch (IOException) { /* best effort; an orphan file is harmless */ }
            }
        }

        private async Task<List<ItemProvided>> LiveItemsAsync(IEnumerable<Guid> ids)
        {
            var result = new List<ItemProvided>();
            foreach (var id in ids)
            {
                var item = await _items.GetItemByIdAsync(id);
                if (item != null) result.Add(item);
            }
            return result;
        }
    }
}
