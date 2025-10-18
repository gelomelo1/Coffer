using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.Domain.Entities;

namespace Coffer.DataAccess.Repositories.Interfaces
{
    public interface IFollowsRepository : IGenericRepository<Guid, FollowProvided, FollowProvided, FollowRequired>
    {
        public Task<FollowProvided?> FindFollowByUserCollectionIdAsync(Guid userId, Guid collectionId);
    }
}
