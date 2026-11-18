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

        public async Task<Coffer.Domain.Paging.GroupedPagedList<CollectionProvided>> GetGroupedPageAsync(Guid userId, IReadOnlyCollection<int> byNameTypeIds, int? page, int? pageSize)
        {
            var byName = byNameTypeIds.ToList();
            var mine = _dbSet.Where(c => c.UserId == userId);
            var counts = await mine.GroupBy(c => c.CollectionTypeId)
                .Select(g => new { TypeId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.TypeId, x => x.Count);

            IQueryable<CollectionProvided> query = mine;
            foreach (var include in includeProvider.GetDefaultIncludes() ?? Array.Empty<string>())
                query = query.Include(include);
            var ordered = query
                .OrderBy(c => c.CollectionTypeId)
                .ThenBy(c => byName.Contains(c.CollectionTypeId) ? c.Name : "")
                .ThenByDescending(c => c.CreatedAt)
                .ThenBy(c => c.Id);
            var result = await Coffer.DataAccess.Extensions.PagingExtensions.ToPagedListAsync(ordered, page, pageSize);
            return new Coffer.Domain.Paging.GroupedPagedList<CollectionProvided>(result.Items, result.Page, result.PageSize, result.Total, counts);
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

        public async Task<Coffer.Domain.Paging.PagedList<CollectionProvided>> SearchCollectionsSmart(string? collectionTypeIds, string searchText, int? page, int? pageSize)
        {
            if (string.IsNullOrWhiteSpace(searchText))
                return Coffer.DataAccess.Extensions.PagingExtensions.Empty<CollectionProvided>(page, pageSize);

            searchText = searchText.Trim();

            var query = BuildBaseQuery(collectionTypeIds);

            var ranked = query
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
                .ThenBy(x => x.Collection.Id)
                .Select(x => x.Collection);

            return await Coffer.DataAccess.Extensions.PagingExtensions.ToPagedListAsync(ranked, page, pageSize);
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
