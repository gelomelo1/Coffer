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
    public class ReactionsRepository : GenericRepository<Guid, ReactionProvided, ReactionProvided, ReactionRequired>, IReactionsRepository
    {
        public ReactionsRepository(CofferDbContext dbContext, IIncludeProvider<ReactionProvided>? includeProvider = null) : base(dbContext, includeProvider)
        {
        }

        public async Task<ReactionProvided?> FindReactionByUserItemIdAsync(Guid userId, Guid itemId)
        {
            var reaction = await _dbSet.SingleOrDefaultAsync(reaction => reaction.UserId == userId && reaction.ItemId == itemId);
            return reaction;
        }

        protected override ReactionProvided MapToEntity(ReactionRequired required, ReactionProvided? entity = null)
        {
            if(entity == null)
            {
                return new ReactionProvided(required.UserId, required.ItemId, required.Liked, required.Rarity);
            }

            entity.UserId = required.UserId;
            entity.ItemId = required.ItemId;
            entity.Liked = required.Liked;
            entity.Rarity = required.Rarity;

            return entity;
        }

        protected override ReactionProvided MapToEntity(ReactionProvided provided, ReactionProvided? entity = null)
        {
            if (entity == null)
            {
                return new ReactionProvided(provided.UserId, provided.ItemId, provided.Liked, provided.User, provided.Item, provided.Rarity);
            }

            return provided;
        }
    }
}
