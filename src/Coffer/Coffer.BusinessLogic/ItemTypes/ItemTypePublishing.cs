using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Moderation;
using Coffer.DataAccess;
using Microsoft.EntityFrameworkCore;

namespace Coffer.BusinessLogic.ItemTypes
{
    public interface IItemTypePublishing
    {
        /// <summary>
        /// Publish (needs both AI models, one primary attribute and an icon) or hide an item type. Hiding deletes nothing;
        /// on publishing again, waiting-for-review items get back the days they spent hidden.
        /// </summary>
        Task<AdminItemTypeDto> SetPublishedAsync(Guid adminId, int typeId, bool published);
    }

    public sealed class ItemTypePublishing : IItemTypePublishing
    {
        private readonly CofferDbContext _db;
        private readonly IClock _clock;
        private readonly IItemTypeAdminService _types;

        public ItemTypePublishing(CofferDbContext db, IClock clock, IItemTypeAdminService types)
        {
            _db = db;
            _clock = clock;
            _types = types;
        }

        public async Task<AdminItemTypeDto> SetPublishedAsync(Guid adminId, int typeId, bool published)
        {
            var type = await _db.CollectionTypes.FirstOrDefaultAsync(t => t.Id == typeId)
                ?? throw MarketplaceException.NotFound("itemTypeNotFound", "Item type not found.");
            if (type.Published == published) return await _types.GetAsync(typeId);
            var now = _clock.UtcNow;

            if (published)
            {
                var blockers = (await _types.GetAsync(typeId)).PublishBlockers;
                if (blockers.Count > 0)
                    throw MarketplaceException.Conflict(blockers[0], "It can't be published yet: " + string.Join(", ", blockers.Select(Describe)) + ".");

                if (type.UnpublishedAt is { } hiddenSince && now > hiddenSince)
                {
                    var hidden = now - hiddenSince;
                    var collections = _db.Collections.Where(c => c.CollectionTypeId == typeId).Select(c => c.Id);
                    foreach (var waiting in await _db.PendingItems.Where(p => collections.Contains(p.CollectionId)).ToListAsync())
                        waiting.CreatedAt += hidden;
                }
                type.Published = true;
                type.UnpublishedAt = null;
                AdminAudit.Add(_db, adminId, "itemType.publish", "itemType", null, new { itemTypeId = typeId }, now);
            }
            else
            {
                type.Published = false;
                type.UnpublishedAt = now;
                AdminAudit.Add(_db, adminId, "itemType.unpublish", "itemType", null, new { itemTypeId = typeId }, now);
            }
            await _db.SaveChangesAsync();
            return await _types.GetAsync(typeId);
        }

        private static string Describe(string blocker) => blocker switch
        {
            "itemTypeNeedsModels" => "upload both AI models",
            "itemTypeNeedsPrimaryAttribute" => "mark exactly one attribute as primary",
            "itemTypeNeedsIcon" => "upload an icon",
            _ => blocker,
        };
    }
}
