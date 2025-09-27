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
    public class CollectionTypesRepository : GenericRepository<Guid, CollectionTypeProvided, CollectionTypeProvided, CollectionTypeRequired>
    {
        public CollectionTypesRepository(CofferDbContext dbContext) : base(dbContext)
        {
        }

        protected override CollectionTypeProvided MapToEntity(CollectionTypeRequired required, CollectionTypeProvided? entity = null)
        {
            if(entity == null)
            {
                return new CollectionTypeProvided(required.Name, required.Description, required.Color, required.Icon);
            }

            entity.Name = required.Name;
            entity.Description = required.Description;
            entity.Color = required.Color;
            entity.Icon = required.Icon;

            return entity;
        }
    }
}
