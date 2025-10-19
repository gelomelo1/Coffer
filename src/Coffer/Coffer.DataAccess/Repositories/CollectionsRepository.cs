using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.DataAccess.Extensions.IncludeProviders;
using Coffer.DataAccess.Extensions.IncludeProviders.Interfaces;
using Coffer.DataAccess.Repositories.Generic;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Coffer.DataAccess.Repositories
{
    public class CollectionsRepository : GenericRepository<Guid, CollectionProvided, CollectionProvided, CollectionRequired>, ICollectionsRepository
    {
        private readonly IIncludeProvider<CollectionProvided> includeProvider;
        public CollectionsRepository(CofferDbContext dbContext, IIncludeProvider<CollectionProvided> includeProvider) : base(dbContext, includeProvider)
        {
            this.includeProvider = includeProvider;
        }

        public async Task<IEnumerable<CollectionProvided>> SearchCollections(int collectionTypeId, string searchText)
        {
            if (string.IsNullOrWhiteSpace(searchText))
                return Enumerable.Empty<CollectionProvided>();

            searchText = searchText.Trim().ToLower();

            // Get default includes from the provider
            var includes = includeProvider.GetDefaultIncludes();

            // Start query
            IQueryable<CollectionProvided> query = _dbSet;

            // Apply includes dynamically
            if (includes != null)
            {
                foreach (var include in includes)
                {
                    query = query.Include(include);
                }
            }

            // Filter by CollectionTypeId and search text
            query = query.Where(c =>
                c.CollectionTypeId == collectionTypeId &&
                c.Name.ToLower().Contains(searchText)
            );

            // Order alphabetically and limit to 10 results
            var collections = await query
                .OrderBy(c => c.Name)
                .Take(10)
                .ToListAsync();

            return collections;
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
                return new CollectionProvided(provided.UserId, provided.CollectionTypeId, provided.Name, provided.User, provided.Image);
            }

            return provided;
        }
    }
}
