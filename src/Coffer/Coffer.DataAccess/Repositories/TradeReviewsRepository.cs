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
            var trade = await _dbContext.Set<TradeProvided>()
                .Include(t => t.Offers)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (trade == null)
                return null;

            var tradedOffer = trade.Offers.FirstOrDefault(o => o.Status == "traded");
            var offererId = tradedOffer?.UserId;

            var reviews = await _dbContext.Set<TradeReviewProvided>()
                .Include(r => r.ReviewerUser)
                .ThenInclude(u => u.Contacts)
                .Include(r => r.RevieweeUser)
                .ThenInclude(u => u.Contacts)
                .Where(r => r.TradeId == id)
                .ToListAsync();

            var traderReview = reviews.FirstOrDefault(r => r.ReviewerId == trade.UserId);

            var offererReview = offererId.HasValue
                ? reviews.FirstOrDefault(r => r.ReviewerId == offererId)
                : null;

            return new TradeReviewPack(traderReview, offererReview);
        }

        public async Task<IEnumerable<TradeReviewPack>> GetTradeReviewsForUser(Guid id)
        {
            var userReviews = await _dbContext.Set<TradeReviewProvided>()
                .Include(r => r.ReviewerUser)
                    .ThenInclude(u => u.Contacts)
                .Include(r => r.RevieweeUser)
                    .ThenInclude(u => u.Contacts)
                .Where(r => r.RevieweeId == id)
                .ToListAsync();

            if (userReviews.Count == 0)
                return Enumerable.Empty<TradeReviewPack>();

            var tradeIds = userReviews.Select(r => r.TradeId).Distinct().ToList();

            var trades = await _dbContext.Set<TradeProvided>()
                .Include(t => t.Offers)
                .Where(t => tradeIds.Contains(t.Id))
                .ToListAsync();

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

                var traderReview = allReviews.FirstOrDefault(r => r.ReviewerId == trade.UserId && r.TradeId == trade.Id);

                var offererReview = offererId.HasValue
                    ? allReviews.FirstOrDefault(r => r.ReviewerId == offererId && r.TradeId == trade.Id)
                    : null;

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
