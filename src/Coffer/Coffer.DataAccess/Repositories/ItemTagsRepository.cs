using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Dynamic.Core;
using System.Text;
using System.Threading.Tasks;
using Coffer.DataAccess.Extensions.IncludeProviders.Interfaces;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Coffer.DataAccess.Repositories
{
    public class ItemTagsRepository : IItemTagsRepository
    {
        protected readonly DbContext _dbContext;
        protected readonly DbSet<ItemTags> _dbSet;
        private readonly IIncludeProvider<ItemProvided> includeProvider;

        public ItemTagsRepository(CofferDbContext dBConetext, IIncludeProvider<ItemProvided> includeProvider)
        {
            _dbContext = dBConetext;
            _dbSet = dBConetext.Set<ItemTags>();
            this.includeProvider = includeProvider;
        }

        public async Task<List<(string value, List<ItemTags> tags)>> SearchTagsAsync(string? collectionTypeIds, string searchText)
        {
            if (string.IsNullOrWhiteSpace(searchText))
                return new List<(string, List<ItemTags>)>();

            searchText = searchText.Trim().ToLower();

            var query = BuildTagBaseQuery(collectionTypeIds);

            query = query.Where(t => t.Tag.ToLower().Contains(searchText));

            var result = await query
                .GroupBy(t => t.Tag)
                .Select(g => new
                {
                    Value = g.Key,
                    Tags = g.ToList(),
                    Count = g.Count()
                })
                .OrderByDescending(x => x.Count)
                .ThenBy(x => x.Value)
                .Take(10)
                .Select(x => new ValueTuple<string, List<ItemTags>>(x.Value, x.Tags))
                .ToListAsync();

            return result;
        }

        public async Task<List<(string value, List<ItemTags> tags)>> SearchTagsSmartAsync(string? collectionTypeIds, string searchText)
        {
            if (string.IsNullOrWhiteSpace(searchText))
                return new List<(string, List<ItemTags>)>();

            searchText = searchText.Trim();

            var query = BuildTagBaseQuery(collectionTypeIds);

            var result = await query
                .Select(t => new
                {
                    Tag = t.Tag,
                    Tags = t,
                    IsExact = EF.Functions.ILike(t.Tag, $"%{searchText}%"),
                    Similarity = EF.Functions.TrigramsSimilarity(t.Tag, searchText)
                })
                .Where(x => x.IsExact || x.Similarity > 0.3)
                .GroupBy(x => x.Tag)
                .Select(g => new
                {
                    Value = g.Key,
                    Tags = g.Select(x => x.Tags).ToList(),
                    MaxSimilarity = g.Max(x => x.Similarity),
                    HasExact = g.Any(x => x.IsExact)
                })
                .OrderByDescending(x => x.HasExact)
                .ThenByDescending(x => x.MaxSimilarity)
                .ThenBy(x => x.Value)
                .Take(10)
                .Select(x => new ValueTuple<string, List<ItemTags>>(x.Value, x.Tags))
                .ToListAsync();

            return result;
        }

        private IQueryable<ItemTags> BuildTagBaseQuery(string? collectionTypeIds)
        {
            IQueryable<ItemTags> query = _dbSet;

            var includes = includeProvider.GetDefaultIncludes();
            if (includes != null)
            {
                foreach (var include in includes)
                {
                    query = query.Include($"Item.{include}");
                }
            }

            query = query.Include(t => t.Item.Collection);

            if (!string.IsNullOrWhiteSpace(collectionTypeIds))
            {
                var ids = collectionTypeIds
                    .Split(';', StringSplitOptions.RemoveEmptyEntries)
                    .Select(int.Parse)
                    .ToList();

                if (ids.Count > 0)
                {
                    query = query.Where(t => ids.Contains(t.Item.Collection.CollectionTypeId));
                }
            }

            return query;
        }
    }
}
