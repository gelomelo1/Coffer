using System;
using System.Collections.Generic;
using System.Linq;
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

        public async Task<List<(string value, List<ItemTags> tags)>> SearchTagsAsync(int collectionTypeId, string searchText)
        {
            if (string.IsNullOrWhiteSpace(searchText))
                return new List<(string, List<ItemTags>)>();

            searchText = searchText.Trim().ToLower();

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

            query = query.Where(t =>
                t.Tag.ToLower().Contains(searchText) &&
                t.Item.Collection.CollectionTypeId == collectionTypeId
            );

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
    }
}
