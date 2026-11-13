using Coffer.DataAccess.Repositories.Interfaces;

namespace Coffer.BusinessLogic.Services
{
    /// <summary>
    /// Verifies that every referenced item belongs to (a collection of) the given user.
    /// Used so users cannot put other users' items into their trades / offers.
    /// </summary>
    public static class ItemOwnershipChecker
    {
        public static async Task<bool> AllItemsOwnedBy(
            Guid userId,
            IEnumerable<Guid?> itemIds,
            IItemsRepository itemsRepository,
            ICollectionsRepository collectionsRepository)
        {
            foreach (var itemId in itemIds.Where(id => id.HasValue).Select(id => id!.Value).Distinct())
            {
                var item = await itemsRepository.GetItemByIdAsync(itemId);
                if (item == null)
                    return false;

                var collection = await collectionsRepository.GetItemByIdAsync(item.CollectionId);
                if (collection == null || collection.UserId != userId)
                    return false;
            }

            return true;
        }
    }
}
