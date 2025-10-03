using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.DataAccess.Repositories.Generic;
using Coffer.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Coffer.DataAccess.Repositories
{
    public class CollectionsRepository : GenericRepository<Guid, CollectionProvided, CollectionProvided, CollectionRequired>
    {
        public CollectionsRepository(CofferDbContext dbContext) : base(dbContext)
        {
        }

        protected override CollectionProvided MapToEntity(CollectionRequired required, CollectionProvided? entity = null)
        {
            if(entity == null)
            {
                return new CollectionProvided(required.UserId, required.CollectionTypeId, required.Name);
            }

            entity.UserId = required.UserId;
            entity.CollectionTypeId = required.CollectionTypeId;
            entity.Name = required.Name;

            return entity;
        }

        protected override CollectionProvided MapToEntity(CollectionProvided provided, CollectionProvided? entity = null)
        {
            if (entity == null)
            {
                return new CollectionProvided(provided.UserId, provided.CollectionTypeId, provided.Name, provided.Image);
            }

            return provided;
        }
    }
}
