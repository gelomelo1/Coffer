using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.Domain.Entities;

namespace Coffer.DataAccess.Repositories.Interfaces
{
    public interface IOffersRepository : IGenericRepository<Guid, OfferProvided, OfferProvided, OfferRequired>
    {
       public Task<OfferProvided?> ChangeOfferStatus(Guid id, string offerStatus);
    }
}
