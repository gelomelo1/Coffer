using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Constants;
using Coffer.Domain.Entities;

namespace Coffer.BusinessLogic.Services
{
    public class TradePermissionService : IPermissionService<Guid, TradeRequired>
    {
        private readonly IUsersRepository _usersRepository;
        private readonly ITradesRepository _tradesRepository;
        private readonly IItemsRepository _itemsRepository;
        private readonly ICollectionsRepository _collectionsRepository;

        public TradePermissionService(IUsersRepository usersRepository, ITradesRepository tradesRepository, IItemsRepository itemsRepository, ICollectionsRepository collectionsRepository)
        {
            _usersRepository = usersRepository;
            _tradesRepository = tradesRepository;
            _itemsRepository = itemsRepository;
            _collectionsRepository = collectionsRepository;
        }

        public async Task<bool> CanCreate(Guid userId, TradeRequired data)
        {
            User? user = await _usersRepository.GetUserById(userId);

            if (user == null)
            {
                return false;
            }

            if (user.Role == UserRole.Admin)
            {
                return true;
            }

            if (userId != data.UserId)
            {
                return false;
            }

            return await ItemOwnershipChecker.AllItemsOwnedBy(userId, data.TradeItems.Select(ti => ti.ItemId), _itemsRepository, _collectionsRepository);
        }

        public async Task<bool> CanDelete(Guid userId, Guid id)
        {
            User? user = await _usersRepository.GetUserById(userId);
            TradeProvided? trade = await _tradesRepository.GetItemByIdAsync(id);

            if (user == null || trade == null)
            {
                return false;
            }

            if (user.Role == UserRole.Admin || user.Role == UserRole.Moderator)
            {
                return true;
            }

            return userId == trade.UserId;
        }

        public async Task<bool> CanUpdate(Guid userId, Guid id, TradeRequired? data)
        {
            User? user = await _usersRepository.GetUserById(userId);
            TradeProvided? trade = await _tradesRepository.GetItemByIdAsync(id);

            if (user == null || trade == null)
            {
                return false;
            }

            if (user.Role == UserRole.Admin)
            {
                return true;
            }

            if (userId != trade.UserId)
            {
                return false;
            }

            if (data == null)
            {
                return true;
            }

            if (userId != data.UserId)
            {
                return false;
            }

            return await ItemOwnershipChecker.AllItemsOwnedBy(userId, data.TradeItems.Select(ti => ti.ItemId), _itemsRepository, _collectionsRepository);
        }
    }
}
