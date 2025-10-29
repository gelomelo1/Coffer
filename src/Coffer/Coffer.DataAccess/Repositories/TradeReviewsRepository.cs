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
        public TradeReviewsRepository(DbContext dbContext, IIncludeProvider<TradeReviewProvided>? includeProvider = null) : base(dbContext, includeProvider)
        {
        }

        protected override TradeReviewProvided MapToEntity(TradeReviewRequired required, TradeReviewProvided? entity = null)
        {
            throw new NotImplementedException();
        }

        protected override TradeReviewProvided MapToEntity(TradeReviewProvided provided, TradeReviewProvided? entity = null)
        {
            throw new NotImplementedException();
        }
    }
}
