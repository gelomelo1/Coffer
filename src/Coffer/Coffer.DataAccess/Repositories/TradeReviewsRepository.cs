using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.DataAccess.Extensions.IncludeProviders.Interfaces;
using Coffer.DataAccess.Repositories.Generic;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Coffer.DataAccess.Repositories
{
    public class TradeReviewsRepository : GenericRepository<Guid, TradeReviewProvided, TradeReviewProvided, TradeReviewRequired>, ITradeReviewRepository
    {
        public TradeReviewsRepository(CofferDbContext dbContext, IIncludeProvider<TradeReviewProvided>? includeProvider = null) : base(dbContext, includeProvider)
        {
        }

        public async Task<TradeReviewPack?> GetTradeReviewByTrade(Guid id)
        {
            // Load the trade with its offers
            var trade = await _dbContext.Set<TradeProvided>()
                .Include(t => t.Offers)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (trade == null)
                return null;

            // Find the offerer whose offer was traded
            var tradedOffer = trade.Offers.FirstOrDefault(o => o.Status == "traded");
            var offererId = tradedOffer?.UserId;

            // Fetch both reviews for this trade
            var reviews = await _dbContext.Set<TradeReviewProvided>()
                .Include(r => r.ReviewerUser)
                .ThenInclude(u => u.Contacts)
                .Include(r => r.RevieweeUser)
                .ThenInclude(u => u.Contacts)
                .Where(r => r.TradeId == id)
                .ToListAsync();

            // Identify trader’s review (by trade owner)
            var traderReview = reviews.FirstOrDefault(r => r.ReviewerId == trade.UserId);

            // Identify offerer’s review (by offer owner with traded offer)
            var offererReview = offererId.HasValue
                ? reviews.FirstOrDefault(r => r.ReviewerId == offererId)
                : null;

            return new TradeReviewPack(traderReview, offererReview);
        }

        public async Task<IEnumerable<TradeReviewPack>> GetTradeReviewsForUser(Guid id)
        {
            // Get all reviews where the given user was reviewed
            var userReviews = await _dbContext.Set<TradeReviewProvided>()
                .Include(r => r.ReviewerUser)
                    .ThenInclude(u => u.Contacts)
                .Include(r => r.RevieweeUser)
                    .ThenInclude(u => u.Contacts)
                .Where(r => r.RevieweeId == id)
                .ToListAsync();

            if (userReviews.Count == 0)
                return Enumerable.Empty<TradeReviewPack>();

            // Collect unique trade IDs from these reviews
            var tradeIds = userReviews.Select(r => r.TradeId).Distinct().ToList();

            // Preload all relevant trades with their offers
            var trades = await _dbContext.Set<TradeProvided>()
                .Include(t => t.Offers)
                .Where(t => tradeIds.Contains(t.Id))
                .ToListAsync();

            // Collect all reviews from those trades (so we can find both sides)
            var allReviews = await _dbContext.Set<TradeReviewProvided>()
                .Include(r => r.ReviewerUser)
                    .ThenInclude(u => u.Contacts)
                .Include(r => r.RevieweeUser)
                    .ThenInclude(u => u.Contacts)
                .Where(r => tradeIds.Contains(r.TradeId))
                .ToListAsync();

            var result = new List<TradeReviewPack>();

            foreach (var trade in trades)
            {
                var tradedOffer = trade.Offers.FirstOrDefault(o => o.Status == "traded");
                var offererId = tradedOffer?.UserId;

                // Find trader’s review (trade owner)
                var traderReview = allReviews.FirstOrDefault(r => r.ReviewerId == trade.UserId && r.TradeId == trade.Id);

                // Find offerer’s review (traded offer owner)
                var offererReview = offererId.HasValue
                    ? allReviews.FirstOrDefault(r => r.ReviewerId == offererId && r.TradeId == trade.Id)
                    : null;

                // Only include if the current user was reviewed
                if (traderReview?.RevieweeId == id || offererReview?.RevieweeId == id)
                {
                    result.Add(new TradeReviewPack(traderReview, offererReview));
                }
            }

            return result;
        }

        protected override TradeReviewProvided MapToEntity(TradeReviewRequired required, TradeReviewProvided? entity = null)
        {
            if (entity == null)
            {
                return new TradeReviewProvided(required.TradeId, required.ReviewerId, required.RevieweeId, required.Rating, required.Comment);
            }

            entity.TradeId = required.TradeId;
            entity.ReviewerId = required.ReviewerId;
            entity.RevieweeId = required.RevieweeId;
            required.Rating = required.Rating;
            required.Comment = required.Comment;

            return entity;
        }

        protected override TradeReviewProvided MapToEntity(TradeReviewProvided provided, TradeReviewProvided? entity = null)
        {
            throw new NotImplementedException();
        }
    }
}
