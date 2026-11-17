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

        public static string NormalizeTag(string tag) => tag.Trim().TrimStart('#').Trim().ToLowerInvariant();

        public async Task<List<TagStat>> GetTagStatsAsync(string? search, IReadOnlyCollection<string>? tags)
        {
            if (tags != null && tags.Count > 0)
            {
                var wanted = tags.Select(NormalizeTag).Where(t => t.Length > 0).Distinct().ToList();
                var counts = await _dbSet
                    .Where(t => wanted.Contains(t.Tag.ToLower()))
                    .GroupBy(t => t.Tag.ToLower())
                    .Select(g => new { Tag = g.Key, Count = g.Select(t => t.ItemId).Distinct().Count() })
                    .ToDictionaryAsync(x => x.Tag, x => x.Count);
                return wanted.Select(t => new TagStat(t, counts.GetValueOrDefault(t))).ToList();
            }

            var text = NormalizeTag(search ?? "");
            if (text.Length == 0)
                return new List<TagStat>();

            var rows = await _dbSet
                .Where(t => t.Tag.ToLower().Contains(text))
                .GroupBy(t => t.Tag.ToLower())
                .Select(g => new { Tag = g.Key, Count = g.Select(t => t.ItemId).Distinct().Count() })
                .OrderByDescending(x => x.Count)
                .ThenBy(x => x.Tag)
                .Take(8)
                .ToListAsync();
            return rows.Select(x => new TagStat(x.Tag, x.Count)).ToList();
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
