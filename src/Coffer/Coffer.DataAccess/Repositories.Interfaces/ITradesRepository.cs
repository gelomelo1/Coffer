using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.Domain.Entities;

namespace Coffer.DataAccess.Repositories.Interfaces
{
    public interface ITradesRepository : IGenericRepository<Guid, TradeProvided, TradeProvided, TradeRequired>
    {
        public Task<TradeProvided> UpdateTradeAsync(Guid tradeId, TradeRequired updated);
        public Task<IEnumerable<TradeProvided>> GetSearchTradesAsync(Guid userId, string? filter = null, string? orderBy = null, int? page = null, int? pageSize = null);
    }
}
