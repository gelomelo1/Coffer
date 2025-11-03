using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.Domain.Entities;

namespace Coffer.DataAccess.Repositories.Interfaces
{
    public record TradeReviewPack(
        TradeReviewProvided? Trader,
        TradeReviewProvided? Offerer
        );
    public interface ITradeReviewRepository : IGenericRepository<Guid, TradeReviewProvided, TradeReviewProvided, TradeReviewRequired>
    {
        public Task<TradeReviewPack?> GetTradeReviewByTrade(Guid id);
        public Task<IEnumerable<TradeReviewPack>> GetTradeReviewsForUser(Guid id);
    }
}
