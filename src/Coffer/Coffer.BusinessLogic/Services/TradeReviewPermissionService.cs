using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Constants;
using Coffer.Domain.Entities;

namespace Coffer.BusinessLogic.Services
{
    /// <summary>
    /// A review can only be written by one party of a traded trade about the other party
    /// (the same trader / traded-offerer pairing TradeReviewsRepository uses to read reviews back).
    /// </summary>
    public class TradeReviewPermissionService : IPermissionService<Guid, TradeReviewRequired>
    {
        private readonly IUsersRepository _usersRepository;
        private readonly ITradeReviewRepository _tradeReviewRepository;
        private readonly ITradesRepository _tradesRepository;

        public TradeReviewPermissionService(IUsersRepository usersRepository, ITradeReviewRepository tradeReviewRepository, ITradesRepository tradesRepository)
        {
            _usersRepository = usersRepository;
            _tradeReviewRepository = tradeReviewRepository;
            _tradesRepository = tradesRepository;
        }

        public async Task<bool> CanCreate(Guid userId, TradeReviewRequired data)
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

            if (data.ReviewerId != userId)
            {
                return false;
            }

            return await IsValidReviewPair(data.TradeId, userId, data.RevieweeId);
        }

        public async Task<bool> CanDelete(Guid userId, Guid id)
        {
            User? user = await _usersRepository.GetUserById(userId);
            TradeReviewProvided? review = await _tradeReviewRepository.GetItemByIdAsync(id);

            if (user == null || review == null)
            {
                return false;
            }

            if (user.Role == UserRole.Admin || user.Role == UserRole.Moderator)
            {
                return true;
            }

            return review.ReviewerId == userId;
        }

        public async Task<bool> CanUpdate(Guid userId, Guid id, TradeReviewRequired? data)
        {
            User? user = await _usersRepository.GetUserById(userId);
            TradeReviewProvided? review = await _tradeReviewRepository.GetItemByIdAsync(id);

            if (user == null || review == null)
            {
                return false;
            }

            if (user.Role == UserRole.Admin)
            {
                return true;
            }

            if (review.ReviewerId != userId)
            {
                return false;
            }

            if (data == null)
            {
                return true;
            }

            return data.ReviewerId == userId
                && data.TradeId == review.TradeId
                && data.RevieweeId == review.RevieweeId;
        }

        private async Task<bool> IsValidReviewPair(Guid tradeId, Guid reviewerId, Guid revieweeId)
        {
            TradeProvided? trade = await _tradesRepository.GetItemByIdAsync(tradeId);

            if (trade == null)
            {
                return false;
            }

            var tradedOffer = trade.Offers.FirstOrDefault(o => o.Status == "traded");

            if (tradedOffer == null)
            {
                return false;
            }

            var traderId = trade.UserId;
            var offererId = tradedOffer.UserId;

            return (reviewerId == traderId && revieweeId == offererId)
                || (reviewerId == offererId && revieweeId == traderId);
        }
    }
}
