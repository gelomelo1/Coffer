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
    public class ReactionsRepository : GenericRepository<Guid, ReactionProvided, ReactionProvided, ReactionRequired>
    {
        public ReactionsRepository(CofferDbContext dbContext, IIncludeProvider<ReactionProvided>? includeProvider = null) : base(dbContext, includeProvider)
        {
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
                return new ReactionProvided(provided.UserId, provided.ItemId, provided.Liked, provided.Rarity, provided.User, provided.Item);
            }

            return provided;
        }
    }
}
