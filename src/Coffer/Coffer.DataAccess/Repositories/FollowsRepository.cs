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
    public class FollowsRepository : GenericRepository<Guid, FollowProvided, FollowProvided, FollowRequired>, IFollowsRepository
    {
        public FollowsRepository(CofferDbContext dbContext, IIncludeProvider<FollowProvided>? includeProvider = null) : base(dbContext, includeProvider)
        {
        }

        public async Task<FollowProvided?> FindFollowByUserCollectionIdAsync(Guid userId, Guid collectionId)
        {
            var follow = await _dbSet.SingleOrDefaultAsync(follow => follow.UserId == userId && follow.CollectionId == collectionId);
            return follow;
        }

        protected override FollowProvided MapToEntity(FollowRequired required, FollowProvided? entity = null)
        {
            if(entity == null)
            {
                return new FollowProvided(required.UserId, required.CollectionId);
            }

            entity.UserId = required.UserId;
            entity.CollectionId = required.CollectionId;

            return entity;
        }

        protected override FollowProvided MapToEntity(FollowProvided provided, FollowProvided? entity = null)
        {
            if(entity == null)
            {
                return new FollowProvided(provided.UserId, provided.CollectionId, provided.User, provided.Collection);
            }

            return provided;
        }
    }
}
