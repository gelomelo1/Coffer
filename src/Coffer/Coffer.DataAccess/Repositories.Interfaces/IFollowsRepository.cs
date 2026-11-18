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
        public Task<IEnumerable<FollowProvided>> FindFollowsOfUser(Guid userId);
        /// <summary>The user's follows ordered by collection type, then collection name, with the count per type.</summary>
        public Task<Coffer.Domain.Paging.GroupedPagedList<FollowProvided>> FindFollowsPageOfUser(Guid userId, int? page, int? pageSize);
    }
}
