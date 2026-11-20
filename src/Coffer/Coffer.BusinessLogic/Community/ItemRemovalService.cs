using Coffer.BusinessLogic.Account;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess;
using Microsoft.EntityFrameworkCore;

namespace Coffer.BusinessLogic.Community
{
    public interface IItemRemovalService
    {
        /// <summary>
        /// Removes a collection item like its owner would: tombstone (comments, reactions, reports stay linked) and its
        /// vector embedding now; the image file via <see cref="DeleteFileAsync"/> after the caller committed.
        /// </summary>
        Task<string?> RemoveAsync(Guid itemId);

        Task DeleteFileAsync(Guid itemId, string? fileName);
    }

    public sealed class ItemRemovalService : IItemRemovalService
    {
        private readonly CofferDbContext _db;
        private readonly IContentTombstoneService _tombstones;
        private readonly IImageService _images;

        public ItemRemovalService(CofferDbContext db, IContentTombstoneService tombstones, IImageService images)
        {
            _db = db;
            _tombstones = tombstones;
            _images = images;
        }

        public static string ItemFolder => ContentTombstoneService.ItemFolder;

        public async Task<string?> RemoveAsync(Guid itemId)
        {
            var file = await _db.Items.Where(i => i.Id == itemId && i.DeletedAt == null).Select(i => i.Image).FirstOrDefaultAsync();
            if (file == null) return null;

            // Tombstone, so other users' comments, reactions and reports stay linked. The embedding goes now (an item
            // the admin removed must leave image search even if the caller's commit is still pending); the file after commit.
            var cleanup = await _tombstones.TombstoneItemAsync(itemId);
            cleanup.Files.Clear();
            await _tombstones.CleanupAsync(cleanup);
            return file;
        }

        public Task DeleteFileAsync(Guid itemId, string? fileName) => _images.DeleteOwnedImageAsync(fileName, itemId, ItemFolder);
    }
}
