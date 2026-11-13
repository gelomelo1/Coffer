using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Constants;
using Coffer.Domain.Entities;

namespace Coffer.BusinessLogic.Services
{
    public class OfferPermissionService : IOfferPermissionService
    {
        // Every status the frontend workflow uses (see Coffer.ReactNative/src/const/trade_status.ts).
        private static readonly HashSet<string> KnownStatuses = new(StringComparer.Ordinal)
        {
            "pending", "rejected", "accepted", "revertByCreator", "revertByOfferer", "traded"
        };

        private readonly IUsersRepository _usersRepository;
        private readonly IOffersRepository _offersRepository;
        private readonly ITradesRepository _tradesRepository;
        private readonly IItemsRepository _itemsRepository;
        private readonly ICollectionsRepository _collectionsRepository;

        public OfferPermissionService(IUsersRepository usersRepository, IOffersRepository offersRepository, ITradesRepository tradesRepository, IItemsRepository itemsRepository, ICollectionsRepository collectionsRepository)
        {
            _usersRepository = usersRepository;
            _offersRepository = offersRepository;
            _tradesRepository = tradesRepository;
            _itemsRepository = itemsRepository;
            _collectionsRepository = collectionsRepository;
        }

        public async Task<bool> CanCreate(Guid userId, OfferRequired data)
        {
            User? user = await _usersRepository.GetUserById(userId);
            TradeProvided? trade = await _tradesRepository.GetItemByIdAsync(data.TradeId);

            if (user == null || trade == null)
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

            return await ItemOwnershipChecker.AllItemsOwnedBy(userId, data.OfferItems.Select(oi => oi.ItemId), _itemsRepository, _collectionsRepository);
        }

        public async Task<bool> CanDelete(Guid userId, Guid id)
        {
            User? user = await _usersRepository.GetUserById(userId);
            OfferProvided? offer = await _offersRepository.GetItemByIdAsync(id);

            if (user == null || offer == null)
            {
                return false;
            }

            if (user.Role == UserRole.Admin || user.Role == UserRole.Moderator)
            {
                return true;
            }

            return userId == offer.UserId;
        }

        public async Task<bool> CanUpdate(Guid userId, Guid id, OfferRequired? data)
        {
            User? user = await _usersRepository.GetUserById(userId);
            OfferProvided? offer = await _offersRepository.GetItemByIdAsync(id);

            if (user == null || offer == null)
            {
                return false;
            }

            if (user.Role == UserRole.Admin)
            {
                return true;
            }

            if (userId != offer.UserId)
            {
                return false;
            }

            if (data == null)
            {
                return true;
            }

            if (userId != data.UserId || offer.TradeId != data.TradeId)
            {
                return false;
            }

            return await ItemOwnershipChecker.AllItemsOwnedBy(userId, data.OfferItems.Select(oi => oi.ItemId), _itemsRepository, _collectionsRepository);
        }

        public async Task<bool> CanChangeStatus(Guid userId, Guid offerId, string status)
        {
            if (status == null || !KnownStatuses.Contains(status))
            {
                return false;
            }

            User? user = await _usersRepository.GetUserById(userId);
            OfferProvided? offer = await _offersRepository.GetItemByIdAsync(offerId);

            if (user == null || offer == null)
            {
                return false;
            }

            if (user.Role == UserRole.Admin)
            {
                return true;
            }

            if (userId == offer.UserId)
            {
                return true;
            }

            TradeProvided? trade = await _tradesRepository.GetItemByIdAsync(offer.TradeId);

            return trade != null && userId == trade.UserId;
        }
    }
}
