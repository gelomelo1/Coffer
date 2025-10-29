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
    public class OffersRepository : GenericRepository<Guid, OfferProvided, OfferProvided, OfferRequired>, IOffersRepository
    {
        public OffersRepository(CofferDbContext dbContext, IIncludeProvider<OfferProvided>? includeProvider = null) : base(dbContext, includeProvider)
        {
        }

        protected override OfferProvided MapToEntity(OfferRequired required, OfferProvided? entity = null)
        {
            throw new NotImplementedException();
        }

        protected override OfferProvided MapToEntity(OfferProvided provided, OfferProvided? entity = null)
        {
            throw new NotImplementedException();
        }
    }
}
