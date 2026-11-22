using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.DataAccess;
using Coffer.DataAccess.Extensions;
using Microsoft.EntityFrameworkCore;

namespace Coffer.BusinessLogic.ItemTypes
{
    /// <summary>
    /// Write-path guard for the app: a missing thing and a thing of an unpublished item type answer the same 404, so a
    /// hidden type's existence is not revealed. (Reads filter with <see cref="PublishedTypes"/>.)
    /// </summary>
    public interface IItemTypeVisibility
    {
        Task EnsureTypeAsync(int typeId);
        Task EnsureCollectionAsync(Guid collectionId);
        Task EnsureItemAsync(Guid itemId);
        Task EnsureListingAsync(Guid listingId);
        Task<bool> IsPublishedAsync(int typeId);
    }

    public sealed class ItemTypeVisibility : IItemTypeVisibility
    {
        private readonly CofferDbContext _db;

        public ItemTypeVisibility(CofferDbContext db)
        {
            _db = db;
        }

        public Task<bool> IsPublishedAsync(int typeId) => _db.CollectionTypes.AnyAsync(t => t.Id == typeId && t.Published);

        public async Task EnsureTypeAsync(int typeId)
        {
            if (!await IsPublishedAsync(typeId))
                throw MarketplaceException.NotFound("itemTypeNotFound", "Item type not found.");
        }

        public async Task EnsureCollectionAsync(Guid collectionId)
        {
            if (!await _db.Collections.Where(c => c.Id == collectionId).WherePublished(_db).AnyAsync())
                throw MarketplaceException.NotFound("collectionNotFound", "Collection not found.");
        }

        public async Task EnsureItemAsync(Guid itemId)
        {
            if (!await _db.Items.Where(i => i.Id == itemId).WherePublished(_db).AnyAsync())
                throw MarketplaceException.NotFound("itemNotFound", "Item not found.");
        }

        public async Task EnsureListingAsync(Guid listingId)
        {
            if (!await _db.Listings.Where(l => l.Id == listingId).WherePublished(_db).AnyAsync())
                throw MarketplaceException.NotFound("listingNotFound", "Listing not found.");
        }
    }
}
