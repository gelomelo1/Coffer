using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.DataAccess.Extensions.IncludeProviders.Interfaces;
using Coffer.DataAccess.Repositories.Generic;
using Coffer.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Coffer.DataAccess.Repositories
{
    public class TradeReviewsRepository : GenericRepository<Guid, TradeReviewProvided, TradeReviewProvided, TradeReviewRequired>
    {
        public TradeReviewsRepository(CofferDbContext dbContext, IIncludeProvider<TradeReviewProvided>? includeProvider = null) : base(dbContext, includeProvider)
        {
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
