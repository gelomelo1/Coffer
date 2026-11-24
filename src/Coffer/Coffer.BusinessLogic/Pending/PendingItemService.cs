using Coffer.DataAccess.Extensions;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Services.Interfaces;
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
    public sealed record PendingItemDto(Guid Id, Guid CollectionId, int Quantity, DateTime CreatedAt, string State, List<ItemProvided> Similars)
    {
        /// <summary>When it is removed if nobody reviews it.</summary>
        public DateTime ExpiresAt => PendingExpiry.ExpiresAt(CreatedAt);
    }

    /// <summary>Waiting items don't stay forever: 30 days after their photo was checked they go, files included.</summary>
    public static class PendingExpiry
    {
        public static readonly TimeSpan Lifetime = TimeSpan.FromDays(30);
        /// <summary>Items expiring within this time are announced (banner, Settings, review screen).</summary>
        public static readonly TimeSpan WarnBefore = TimeSpan.FromDays(3);
        public static DateTime ExpiresAt(DateTime createdAt) => createdAt + Lifetime;
    }

    /// <summary>What one photo produced: the new waiting caps, and how many detections were lost (their files had vanished).</summary>
    public sealed record ImageCheckResultDto(List<PendingItemDto> Created, int Lost);

    /// <summary>One collection's share of the user's waiting list.</summary>
    public sealed record PendingSummaryDto(Guid CollectionId, string CollectionName, int CollectionTypeId, int Count, Guid LatestId,
        /// <summary>How many expire within <see cref="PendingExpiry.WarnBefore"/>, and when the first one goes.</summary>
        int ExpiringSoon, DateTime NextExpiresAt);

    /// <summary>Add a waiting cap: either more of an existing item (<see cref="MatchItemId"/>) or a new item (<see cref="Item"/>).</summary>
    public sealed record AddPendingInput(Guid? MatchItemId, ItemRequired? Item, int Quantity);

    public interface IPendingItemService
    {
        /// <summary>Runs the AI check on one photo and puts every detected cap on the collection's waiting list.</summary>
        Task<ImageCheckResultDto> CreateFromImageAsync(Guid userId, CollectionProvided collection, IFormFile file);

        /// <summary>The collection's waiting caps, newest first, with matches computed against the collection as it is now.</summary>
        Task<Coffer.Domain.Paging.PagedList<PendingItemDto>> ListAsync(Guid userId, Guid collectionId, int? page, int? pageSize);

        Task<List<PendingSummaryDto>> SummaryAsync(Guid userId);

        /// <summary>File name of the owner's waiting cap's crop in <see cref="PendingItemService.PendingFolder"/>.</summary>
        Task<string> ImageAsync(Guid userId, Guid pendingId);

        Task<ItemProvided> AddAsync(Guid userId, Guid pendingId, AddPendingInput input);

        /// <summary>Skip &amp; delete: the cap and its files are gone. Already gone is fine.</summary>
        Task DeleteAsync(Guid userId, Guid pendingId);

        /// <summary>Removes items older than <see cref="PendingExpiry.Lifetime"/> with their files; returns how many.</summary>
        Task<int> PurgeExpiredAsync(DateTime now);
    }

    public sealed class PendingItemService : IPendingItemService
    {
        private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };

        private readonly CofferDbContext _db;
        private readonly IItemsRepository _items;
        private readonly HttpClient _http;
        private readonly ILogger<PendingItemService> _log;
        private readonly IImageService _images;
        private readonly IPermissionService<Guid, ItemRequired> _itemPermissions;
        private readonly IClock _clock;
        private readonly Coffer.BusinessLogic.Activity.IActivityLog? _activity;

        public PendingItemService(CofferDbContext db, IItemsRepository items, HttpClient http, ILogger<PendingItemService> log,
            IImageService images, IPermissionService<Guid, ItemRequired> itemPermissions, IClock clock, Coffer.BusinessLogic.Activity.IActivityLog? activity = null)
        {
            _activity = activity;
            _clock = clock;
            _db = db;
            _items = items;
            _http = http;
            _log = log;
            _images = images;
            _itemPermissions = itemPermissions;
        }

        private static string ItemFolder => Coffer.BusinessLogic.Account.ContentTombstoneService.ItemFolder;

        private static MarketplaceException AiSaveFailed() =>
            MarketplaceException.Unavailable("theAiServiceCouldNotSaveTheItem", "The AI service could not save the item. It is still waiting for review.");

        private static MarketplaceException PendingNotFound() =>
            MarketplaceException.NotFound("pendingItemNotFound", "This item is no longer waiting for review.");

        private IQueryable<Guid> ShownCollections => _db.Collections.WherePublished(_db).Select(c => c.Id);

        private async Task<PendingItem> OwnPendingAsync(Guid userId, Guid pendingId) =>
            await _db.PendingItems.FirstOrDefaultAsync(p => p.Id == pendingId && p.UserId == userId && ShownCollections.Contains(p.CollectionId))
            ?? throw PendingNotFound();

        public async Task<Coffer.Domain.Paging.PagedList<PendingItemDto>> ListAsync(Guid userId, Guid collectionId, int? page, int? pageSize)
        {
            if (!await _db.Collections.WherePublished(_db).AnyAsync(c => c.Id == collectionId && c.UserId == userId && c.DeletedAt == null))
                throw PendingNotFound();
            var query = _db.PendingItems.AsNoTracking().Where(p => p.CollectionId == collectionId && p.UserId == userId)
                .OrderByDescending(p => p.CreatedAt).ThenBy(p => p.Id);
            var rows = await Coffer.DataAccess.Extensions.PagingExtensions.ToPagedListAsync(query, page, pageSize);
            var matches = await MatchAsync(collectionId, rows.Items.Select(r => r.Id).ToList());

            var items = new List<PendingItemDto>();
            foreach (var row in rows.Items)
            {
                var (state, similars) = matches.TryGetValue(row.Id, out var m) ? m : ("not found", new List<Guid>());
                items.Add(new PendingItemDto(row.Id, row.CollectionId, row.Quantity, row.CreatedAt, state, await LiveItemsAsync(similars)));
            }
            return new Coffer.Domain.Paging.PagedList<PendingItemDto>(items, rows.Page, rows.PageSize, rows.Total);
        }

        private sealed record Match(Guid Id, string State, List<Guid>? Similars);
        private sealed record MatchResponse(string Status, List<Match>? Response);

        /// <summary>Fresh matches from the stored fingerprints. If the AI service fails, the list still shows: every cap "not found".</summary>
        private async Task<Dictionary<Guid, (string State, List<Guid> Similars)>> MatchAsync(Guid collectionId, List<Guid> ids)
        {
            var result = new Dictionary<Guid, (string, List<Guid>)>();
            if (ids.Count == 0) return result;
            try
            {
                var typeId = await _db.Collections.Where(c => c.Id == collectionId).Select(c => c.CollectionTypeId).FirstOrDefaultAsync();
                var response = await _http.PostAsJsonAsync($"{PythonUrl}/pending_similars/{collectionId}?type_id={typeId}", new { ids });
                if (!response.IsSuccessStatusCode) return result;
                var parsed = JsonSerializer.Deserialize<MatchResponse>(await response.Content.ReadAsStringAsync(), Json);
                foreach (var m in parsed?.Response ?? new()) result[m.Id] = (m.State, m.Similars ?? new());
            }
            catch (Exception e) when (e is HttpRequestException or JsonException or TaskCanceledException)
            {
                _log.LogWarning("Matching waiting caps failed: {Error}", e.Message);
            }
            return result;
        }

        public async Task<List<PendingSummaryDto>> SummaryAsync(Guid userId)
        {
            var rows = await _db.PendingItems.AsNoTracking().Where(p => p.UserId == userId)
                .Join(_db.Collections.Where(c => c.DeletedAt == null).WherePublished(_db), p => p.CollectionId, c => c.Id,
                    (p, c) => new { PendingId = p.Id, p.CreatedAt, CollectionId = c.Id, c.Name, c.CollectionTypeId })
                .ToListAsync();
            return rows
                .GroupBy(r => r.CollectionId)
                .Select(g =>
                {
                    var latest = g.OrderByDescending(x => x.CreatedAt).First();
                    var oldest = g.Min(x => x.CreatedAt);
                    var warnFrom = _clock.UtcNow + PendingExpiry.WarnBefore;
                    var soon = g.Count(x => PendingExpiry.ExpiresAt(x.CreatedAt) <= warnFrom);
                    return new PendingSummaryDto(g.Key, latest.Name, latest.CollectionTypeId, g.Count(), latest.PendingId, soon, PendingExpiry.ExpiresAt(oldest));
                })
                .OrderBy(s => s.CollectionName)
                .ToList();
        }

        public async Task<string> ImageAsync(Guid userId, Guid pendingId) => (await OwnPendingAsync(userId, pendingId)).Image;

        public async Task<int> PurgeExpiredAsync(DateTime now)
        {
            var cutoff = now - PendingExpiry.Lifetime;
            // Items of a hidden (unpublished) item type wait: nobody can review them, and hiding deletes nothing.
            var shown = _db.Collections.WherePublished(_db).Select(c => c.Id);
            var expired = await _db.PendingItems.Where(p => p.CreatedAt <= cutoff && shown.Contains(p.CollectionId)).ToListAsync();
            if (expired.Count == 0) return 0;
            _db.PendingItems.RemoveRange(expired);
            await _db.SaveChangesAsync();
            foreach (var row in expired) DeleteFiles(row.Id);
            return expired.Count;
        }

        public async Task DeleteAsync(Guid userId, Guid pendingId)
        {
            var row = await _db.PendingItems.FirstOrDefaultAsync(p => p.Id == pendingId && ShownCollections.Contains(p.CollectionId));
            if (row == null) return; // already gone: Skip & delete may be sent twice
            if (row.UserId != userId) throw PendingNotFound();
            _db.PendingItems.Remove(row);
            await _db.SaveChangesAsync();
            DeleteFiles(row.Id);
        }

        public async Task<ItemProvided> AddAsync(Guid userId, Guid pendingId, AddPendingInput input)
        {
            var row = await OwnPendingAsync(userId, pendingId);
            if ((input.MatchItemId == null) == (input.Item == null))
                throw MarketplaceException.Validation("chooseAMatchOrANewItem", "Choose an existing item or describe a new one.");
            if (input.Quantity < 1)
                throw MarketplaceException.Validation("quantityMustBeAtLeast1", "Quantity must be at least 1.");

            if (input.MatchItemId is Guid matchId)
            {
                var match = await _db.Items.FirstOrDefaultAsync(i => i.Id == matchId && i.CollectionId == row.CollectionId && i.DeletedAt == null)
                    ?? throw MarketplaceException.NotFound("matchItemNotFound", "The item to add to no longer exists.");
                match.Quantity += input.Quantity;
                _activity?.Record(userId, "item.addedToExisting", new Coffer.BusinessLogic.Activity.ActivityTargets(ItemId: match.Id, CollectionId: match.CollectionId), new { quantity = input.Quantity });
                _db.PendingItems.Remove(row);
                await _db.SaveChangesAsync();
                DeleteFiles(row.Id);
                return match;
            }

            return await AddAsNewAsync(userId, row, input.Item!, input.Quantity);
        }

        private async Task<ItemProvided> AddAsNewAsync(Guid userId, PendingItem row, ItemRequired item, int quantity)
        {
            item.CollectionId = row.CollectionId;
            item.Quantity = quantity;
            item.Image = "";

            var typeId = await _db.Collections.Where(c => c.Id == row.CollectionId).Select(c => c.CollectionTypeId).FirstAsync();
            var attributes = await _db.Attributes.AsNoTracking().Where(a => a.CollectionTypeId == typeId).ToListAsync();
            var missing = RequiredAttributes.Missing(attributes, item.ItemAttributes);
            if (missing.Count > 0)
                throw MarketplaceException.Validation("requiredAttributeMissing", $"{missing[0].Name} is required.", ErrorArgs.Of(missing[0].Name));
            if (!await _itemPermissions.CanCreate(userId, item))
                throw MarketplaceException.Validation("itemDetailsNotAllowed", "The item details contain something that is not allowed.");

            string? copied = null;
            await using var tx = await _db.Database.BeginTransactionAsync();
            try
            {
                var created = await _items.InsertItemAsync(item);
                _activity?.Record(userId, "item.added", new Coffer.BusinessLogic.Activity.ActivityTargets(ItemId: created.Id, CollectionId: row.CollectionId), new { quantity });
                copied = await _images.CopyImageAsync(created.Id, Path.Combine(PendingFolder, row.Image), ItemFolder);
                created.Image = copied;
                _db.PendingItems.Remove(row);
                await _db.SaveChangesAsync();

                // Its fingerprint makes the new item a match for later photos; without it the add is not complete.
                var response = await _http.PostAsJsonAsync($"{PythonUrl}/save_pending_embedding/{row.CollectionId}", new { pendingId = row.Id, itemId = created.Id });
                var body = await response.Content.ReadAsStringAsync();
                if (!response.IsSuccessStatusCode || body.Contains("\"error\"", StringComparison.Ordinal))
                    throw AiSaveFailed();

                await tx.CommitAsync();
                DeleteFiles(row.Id);
                return created;
            }
            catch (Exception e)
            {
                await tx.RollbackAsync();
                _db.ChangeTracker.Clear();
                if (copied != null)
                {
                    try { await _images.DeleteImageAsync(copied, ItemFolder); }
                    catch (Exception) { /* an orphan file is harmless */ }
                }
                if (e is MarketplaceException) throw;
                if (e is HttpRequestException or TaskCanceledException) throw AiSaveFailed();
                if (e is ArgumentException arg) throw MarketplaceException.Validation("itemDetailsNotAllowed", arg.Message);
                throw;
            }
        }

        private static string ImageStore => Coffer.BusinessLogic.AppConfig.AppPaths.Images;
        private static string TempFolder => Coffer.BusinessLogic.AppConfig.AppPaths.Temp;
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
            var parsed = JsonSerializer.Deserialize<DetectionResponse>(await response.Content.ReadAsStringAsync(), Json);
            // FastAPI answers 200 with status "error" when the check itself failed: that is a failure, not "no caps".
            if (parsed == null || !string.Equals(parsed.Status, "ok", StringComparison.OrdinalIgnoreCase))
                throw new HttpRequestException("The AI service could not check the photo.");
            var detections = parsed.Response ?? new();

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

    /// <summary>Which required attributes (the primary always) have no value yet. Same rules as the app's required_fields.ts.</summary>
    public static class RequiredAttributes
    {
        public static List<Domain.Entities.Attribute> Missing(IEnumerable<Domain.Entities.Attribute> attributes, IEnumerable<ItemAttributeRequired> values)
        {
            var byId = values.GroupBy(v => v.AttributeId).ToDictionary(g => g.Key, g => g.First());
            return attributes
                .Where(AttributeRules.IsRequired)
                .OrderByDescending(a => a.Primary).ThenBy(a => a.Id)
                .Where(a => !byId.TryGetValue(a.Id, out var v) || !IsFilled(a, v))
                .ToList();
        }

        /// <summary>Text-like: not blank. Number and date: set. A yes/no always counts (false is an answer).</summary>
        public static bool IsFilled(Domain.Entities.Attribute attribute, ItemAttributeRequired value) => attribute.DataType switch
        {
            Domain.Constants.AttributeType.Boolean => true,
            Domain.Constants.AttributeType.Number => value.ValueNumber.HasValue,
            Domain.Constants.AttributeType.Date => value.ValueDate.HasValue,
            _ => !string.IsNullOrWhiteSpace(value.ValueString),
        };
    }

    /// <summary>Hourly: waiting items past their 30 days go (rows and files).</summary>
    public sealed class PendingExpirySweep : Coffer.BusinessLogic.Marketplace.IMarketplaceSweep
    {
        private readonly IPendingItemService _pending;
        private readonly IClock _clock;

        public PendingExpirySweep(IPendingItemService pending, IClock clock)
        {
            _pending = pending;
            _clock = clock;
        }

        public Task SweepAsync() => _pending.PurgeExpiredAsync(_clock.UtcNow);
    }
}
