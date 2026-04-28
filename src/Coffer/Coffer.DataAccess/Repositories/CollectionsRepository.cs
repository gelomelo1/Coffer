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
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql.EntityFrameworkCore.PostgreSQL;

namespace Coffer.DataAccess.Repositories
{
    public class CollectionsRepository : GenericRepository<Guid, CollectionProvided, CollectionProvided, CollectionRequired>, ICollectionsRepository
    {
        private readonly IIncludeProvider<CollectionProvided> includeProvider;
        public CollectionsRepository(CofferDbContext dbContext, IIncludeProvider<CollectionProvided> includeProvider) : base(dbContext, includeProvider)
        {
            this.includeProvider = includeProvider;
        }

        public async Task<IDbContextTransaction> BeginTransactionAsync()
        {
            return await _dbContext.Database.BeginTransactionAsync();
        }

        public async Task<CollectionProvided?> GetCollectionByIdForDelete(Guid id)
        {
            return await _dbSet
                .FirstOrDefaultAsync(collection => collection.Id == id);
        }

        public async Task<IEnumerable<CollectionProvided>> SearchCollections(string? collectionTypeIds, string searchText)
        {
            if (string.IsNullOrWhiteSpace(searchText))
                return Enumerable.Empty<CollectionProvided>();

            searchText = searchText.Trim();

            var query = BuildBaseQuery(collectionTypeIds);

            query = query.Where(c =>
            EF.Functions.ILike(c.Name, $"%{searchText}%"));

            var collections = await query
                .OrderBy(c => c.Name)
                .Take(10)
                .ToListAsync();

            return collections;
        }

        public async Task<IEnumerable<CollectionProvided>> SearchCollectionsSmart(string? collectionTypeIds, string searchText)
        {
            if (string.IsNullOrWhiteSpace(searchText))
                return Enumerable.Empty<CollectionProvided>();

            searchText = searchText.Trim();

            var query = BuildBaseQuery(collectionTypeIds);

            var results = await query
                .Select(c => new
                {
                    Collection = c,
                    Similarity = EF.Functions.TrigramsSimilarity(c.Name, searchText),
                    IsExact = EF.Functions.ILike(c.Name, $"%{searchText}%")
                })
                .Where(x =>
                    x.IsExact || x.Similarity > 0.3)
                .OrderByDescending(x => x.IsExact)     
                .ThenByDescending(x => x.Similarity)   
                .ThenBy(x => x.Collection.Name)          
                .Take(10)
                .Select(x => x.Collection)
                .ToListAsync();

            return results;
        }

        protected override CollectionProvided MapToEntity(CollectionRequired required, CollectionProvided? entity = null)
        {
            if(entity == null)
            {
                return new CollectionProvided(required.UserId, required.CollectionTypeId, required.Name, null, required.Description);
            }

            entity.UserId = required.UserId;
            entity.CollectionTypeId = required.CollectionTypeId;
            entity.Name = required.Name;
            entity.Description = required.Description;

            return entity;
        }

        protected override CollectionProvided MapToEntity(CollectionProvided provided, CollectionProvided? entity = null)
        {
            if (entity == null)
            {
                return new CollectionProvided(provided.UserId, provided.CollectionTypeId, provided.Name, provided.User, provided.Image, provided.Description);
            }

            return provided;
        }

        private IQueryable<CollectionProvided> BuildBaseQuery(string? collectionTypeIds)
        {
            var includes = includeProvider.GetDefaultIncludes();

            IQueryable<CollectionProvided> query = _dbSet;

            if (includes != null)
            {
                foreach (var include in includes)
                {
                    query = query.Include(include);
                }
            }

            if (!string.IsNullOrWhiteSpace(collectionTypeIds))
            {
                var collectionTypeIdsProcessed = collectionTypeIds
                    .Split(';', StringSplitOptions.RemoveEmptyEntries)
                    .Select(int.Parse)
                    .ToList();

                if (collectionTypeIdsProcessed.Count > 0)
                {
                    query = query.Where(c =>
                        collectionTypeIdsProcessed.Contains(c.CollectionTypeId));
                }
            }

            return query;
        }
    }
}
