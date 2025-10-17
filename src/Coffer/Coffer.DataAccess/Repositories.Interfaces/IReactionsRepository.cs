using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.Domain.Entities;

namespace Coffer.DataAccess.Repositories.Interfaces
{
    public interface IReactionsRepository : IGenericRepository<Guid, ReactionProvided, ReactionProvided, ReactionRequired>
    {
        public Task<ReactionProvided?> FindReactionByUserItemIdAsync(Guid userId, Guid itemId);
    }
}
