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
    public class TradesRepository : GenericRepository<Guid, TradeProvided, TradeProvided, TradeRequired>, ITradesRepository
    {
        public TradesRepository(CofferDbContext dbContext, IIncludeProvider<TradeProvided>? includeProvider = null) : base(dbContext, includeProvider)
        {

        }

        protected override TradeProvided MapToEntity(TradeRequired required, TradeProvided? entity = null)
        {
            throw new NotImplementedException();
        }

        protected override TradeProvided MapToEntity(TradeProvided provided, TradeProvided? entity = null)
        {
            throw new NotImplementedException();
        }
    }
}
