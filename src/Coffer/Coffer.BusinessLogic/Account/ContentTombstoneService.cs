using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess;
using DotNetEnv;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Coffer.BusinessLogic.Account
{
    /// <summary>
    /// Files and AI embeddings of tombstoned content. They can't take part in the database transaction, so they are
    /// removed after it, best effort: what keeps users accountable is the database state, not the files.
    /// </summary>
    public sealed class TombstoneCleanup
    {
        public List<(Guid OwnerId, string File, string Folder)> Files { get; } = new();
        public List<Guid> ItemEmbeddings { get; } = new();
        public List<Guid> CollectionEmbeddings { get; } = new();
        /// <summary>Full paths deleted as they are (waiting caps' crops and fingerprints).</summary>
        public List<string> RawFiles { get; } = new();

        public TombstoneCleanup Add(TombstoneCleanup other)
        {
            Files.AddRange(other.Files);
            ItemEmbeddings.AddRange(other.ItemEmbeddings);
            CollectionEmbeddings.AddRange(other.CollectionEmbeddings);
            RawFiles.AddRange(other.RawFiles);
            return this;
        }
    }

    /// <summary>
    /// Deletes users' content without deleting other users' data: the row stays as an empty placeholder
    /// ("tombstone", deleted_at set) so comments, replies, reactions, reports, chats, deals and reviews that point at
    /// it keep their link. Every deletion of items and collections goes through here.
    /// </summary>
    public interface IContentTombstoneService
    {
        /// <summary>Wipes an item and saves (joins the caller's transaction, if any). Files/embedding: <see cref="CleanupAsync"/>.</summary>
        Task<TombstoneCleanup> TombstoneItemAsync(Guid itemId);

        /// <summary>Wipes a collection and all its items, and removes the follows of it; saves like <see cref="TombstoneItemAsync"/>.</summary>
        Task<TombstoneCleanup> TombstoneCollectionAsync(Guid collectionId);

        /// <summary>Removes waiting-for-review caps (rows when the caller saves, files through <see cref="CleanupAsync"/>).</summary>
        Task<TombstoneCleanup> RemovePendingAsync(System.Linq.Expressions.Expression<Func<Coffer.Domain.Entities.PendingItem, bool>> which);

        /// <summary>Removes files and embeddings after the database change is committed; failures are logged and skipped.</summary>
        Task CleanupAsync(TombstoneCleanup cleanup);
    }

    public sealed class ContentTombstoneService : IContentTombstoneService
    {
        private readonly CofferDbContext _db;
        private readonly IImageService _images;
        private readonly HttpClient _http;
        private readonly ILogger<ContentTombstoneService> _log;

        public ContentTombstoneService(CofferDbContext db, IImageService images, HttpClient http, ILogger<ContentTombstoneService> log)
        {
            _db = db;
            _images = images;
            _http = http;
            _log = log;
        }

        private static string ImageStore => Env.GetString("IMAGESTORE_PATH") ?? throw new InvalidOperationException("IMAGESTORE_PATH envionmental variable is not set");
        public static string ItemFolder => Path.Combine(ImageStore, "items");
        public static string CollectionFolder => Path.Combine(ImageStore, "collectioncovers");
        private static string PythonUrl => Env.GetString("FASTAPI_URL") ?? throw new InvalidOperationException("FASTAPI_URL envionmental variable is not set");

        public async Task<TombstoneCleanup> TombstoneItemAsync(Guid itemId)
        {
            var cleanup = await WipeItemsAsync(i => i.Id == itemId);
            await _db.SaveChangesAsync();
            return cleanup;
        }

        public async Task<TombstoneCleanup> TombstoneCollectionAsync(Guid collectionId)
        {
            var cleanup = new TombstoneCleanup();
            var collection = await _db.Collections.FirstOrDefaultAsync(c => c.Id == collectionId && c.DeletedAt == null);
            if (collection == null) return cleanup;

            if (!string.IsNullOrEmpty(collection.Image)) cleanup.Files.Add((collection.Id, collection.Image, CollectionFolder));
            cleanup.CollectionEmbeddings.Add(collection.Id);
            collection.Name = "";
            collection.Description = null;
            collection.Image = null;
            collection.DeletedAt = DateTime.UtcNow;
            // A follow is a subscription, not content: nobody is accountable for it, and a dead collection in
            // someone's follows list is just noise.
            _db.Follows.RemoveRange(await _db.Follows.Where(f => f.CollectionId == collectionId).ToListAsync());

            // Caps still waiting for review are the owner's own data; nobody else links to them.
            cleanup.Add(await RemovePendingAsync(p => p.CollectionId == collectionId));

            cleanup.Add(await WipeItemsAsync(i => i.CollectionId == collectionId));
            await _db.SaveChangesAsync();
            return cleanup;
        }

        /// <summary>Removes waiting caps (rows now, files with the cleanup).</summary>
        public async Task<TombstoneCleanup> RemovePendingAsync(System.Linq.Expressions.Expression<Func<Coffer.Domain.Entities.PendingItem, bool>> which)
        {
            var cleanup = new TombstoneCleanup();
            var rows = await _db.PendingItems.Where(which).ToListAsync();
            foreach (var row in rows)
            {
                cleanup.RawFiles.Add(Path.Combine(Coffer.BusinessLogic.Pending.PendingItemService.PendingFolder, $"{row.Id}.jpg"));
                cleanup.RawFiles.Add(Path.Combine(Coffer.BusinessLogic.Pending.PendingItemService.PendingFolder, $"{row.Id}.npy"));
            }
            _db.PendingItems.RemoveRange(rows);
            return cleanup;
        }

        private async Task<TombstoneCleanup> WipeItemsAsync(System.Linq.Expressions.Expression<Func<Coffer.Domain.Entities.ItemProvided, bool>> which)
        {
            var cleanup = new TombstoneCleanup();
            var items = await _db.Items.Where(which).Where(i => i.DeletedAt == null).ToListAsync();
            if (items.Count == 0) return cleanup;
            var ids = items.Select(i => i.Id).ToList();
            var now = DateTime.UtcNow;

            foreach (var item in items)
            {
                if (!string.IsNullOrEmpty(item.Image)) cleanup.Files.Add((item.Id, item.Image, ItemFolder));
                cleanup.ItemEmbeddings.Add(item.Id);
                item.Description = null;
                item.PrivateNote = null;
                item.Image = "";
                item.DeletedAt = now;
            }
            // Comments, replies, reactions and reports of other users stay linked to the tombstone.
            _db.ItemAttributes.RemoveRange(await _db.ItemAttributes.Where(a => ids.Contains(a.ItemId)).ToListAsync());
            _db.ItemTags.RemoveRange(await _db.ItemTags.Where(t => ids.Contains(t.ItemId)).ToListAsync());
            return cleanup;
        }

        public async Task CleanupAsync(TombstoneCleanup cleanup)
        {
            // Collection embeddings cover their items; single items are removed one by one.
            foreach (var id in cleanup.CollectionEmbeddings) await DeleteEmbeddingAsync($"delete_collection_embeddings/{id}");
            if (cleanup.CollectionEmbeddings.Count == 0)
                foreach (var id in cleanup.ItemEmbeddings) await DeleteEmbeddingAsync($"delete_embeddings/{id}");

            foreach (var (ownerId, file, folder) in cleanup.Files)
                await _images.DeleteOwnedImageAsync(file, ownerId, folder);

            foreach (var path in cleanup.RawFiles)
            {
                try { if (File.Exists(path)) File.Delete(path); }
                catch (IOException e) { _log.LogWarning("Could not delete {Path}: {Error}", path, e.Message); }
            }
        }

        private async Task DeleteEmbeddingAsync(string path)
        {
            try
            {
                var response = await _http.DeleteAsync($"{PythonUrl}/{path}");
                var body = await response.Content.ReadAsStringAsync();
                if (!response.IsSuccessStatusCode || body.Contains("\"error\"", StringComparison.Ordinal))
                    _log.LogWarning("The AI service did not delete {Path} ({Status}); the content is tombstoned and hidden anyway.", path, (int)response.StatusCode);
            }
            catch (Exception e)
            {
                _log.LogWarning("Could not reach the AI service for {Path}: {Error}; the content is tombstoned and hidden anyway.", path, e.Message);
            }
        }
    }
}
