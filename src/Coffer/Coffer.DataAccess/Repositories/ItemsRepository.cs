using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Dynamic.Core;
using System.Text;
using System.Threading.Tasks;
using Coffer.DataAccess.Extensions.IncludeProviders;
using Coffer.DataAccess.Extensions.IncludeProviders.Interfaces;
using Coffer.DataAccess.Repositories.Generic;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Coffer.DataAccess.Repositories
{
    public class ItemsRepository : GenericRepository<Guid, ItemProvided, ItemProvided, ItemRequired>, IItemsRepository
    {
        private readonly IIncludeProvider<ItemProvided> includeProvider;
        public ItemsRepository(CofferDbContext dbContext, IIncludeProvider<ItemProvided> includeProvider) : base(dbContext, includeProvider)
        {
            this.includeProvider = includeProvider;
        }

        public async Task<IDbContextTransaction> BeginTransactionAsync()
        {
            return await _dbContext.Database.BeginTransactionAsync();
        }

        public async Task<IEnumerable<ItemProvided>> GetFeedItemsAsync(
    User user,
    string? filter = null,
    string? orderBy = null,
    int? page = null,
    int? pageSize = null)
{
    var oneWeekAgo = DateTime.UtcNow.AddDays(-7);
    var random = new Random();

    IQueryable<ItemProvided> baseQuery = _dbSet
        .Include(i => i.Reactions)
        .Include(i => i.ItemAttributes)
            .ThenInclude(ia => ia.Attribute)
        .Include(i => i.ItemTags)
        .Include(i => i.Collection)
        .Include(i => i.Collection.Follows)
        .Where(i =>
            i.Collection.UserId != user.Id &&
            i.AcquiredAt >= oneWeekAgo);

    if (!string.IsNullOrWhiteSpace(filter))
    {
        baseQuery = baseQuery.Where(filter);
    }

    if (!string.IsNullOrWhiteSpace(orderBy))
    {
        baseQuery = baseQuery.OrderBy(orderBy);
    }

    if (page.HasValue && pageSize.HasValue)
    {
        baseQuery = baseQuery
            .Skip((page.Value - 1) * pageSize.Value)
            .Take(pageSize.Value);
    }

    var query = baseQuery
        .Select(i => new
        {
            Item = i,
            Score =
                (i.Collection.Follows.Any(f => f.UserId == user.Id) ? 100 : 0) +
                (i.Collection.User.Country == user.Country ? 50 : 0) +
                random.NextDouble() * 20
        });

    var items = await query
        .OrderByDescending(x => x.Score)
        .ThenByDescending(x => x.Item.AcquiredAt)
        .Select(x => x.Item)
        .ToListAsync();

    return items;
}

        private static string? GetPrimaryAttributeValueAsString(ItemProvided item)
        {
            var primaryAttr = item.ItemAttributes
                .FirstOrDefault(ia => ia.Attribute?.Primary == true);

            if (primaryAttr == null) return null;

            if (!string.IsNullOrEmpty(primaryAttr.ValueString))
                return primaryAttr.ValueString;
            if (primaryAttr.ValueNumber.HasValue)
                return primaryAttr.ValueNumber.Value.ToString();
            if (primaryAttr.ValueDate.HasValue)
                return primaryAttr.ValueDate.Value.ToString("o");
            if (primaryAttr.ValueBoolean.HasValue)
                return primaryAttr.ValueBoolean.Value ? "true" : "false";

            return null;
        }

        public async Task<IEnumerable<ItemProvided>> SearchItems(string? collectionTypeIds, string searchText)
        {
            if (string.IsNullOrWhiteSpace(searchText))
                return Enumerable.Empty<ItemProvided>();

            searchText = searchText.Trim().ToLower();

            var includes = includeProvider.GetDefaultIncludes();

            IQueryable<ItemProvided> query = _dbContext.Set<ItemProvided>();

            if (includes != null)
            {
                foreach (var include in includes)
                {
                    query = query.Include(include);
                }
            }

            List<int> collectionTypeIdsProcessed = string.IsNullOrWhiteSpace(collectionTypeIds)
                ? new List<int>()
                : collectionTypeIds
                    .Split(';', StringSplitOptions.RemoveEmptyEntries)
                    .Select(int.Parse)
                    .ToList();

            query = query.Include(i => i.Collection);

            if(collectionTypeIdsProcessed.Count > 0)
            {
                query = query.Where(i => collectionTypeIdsProcessed.Contains(i.Collection.CollectionTypeId));
            }

            var items = await query.ToListAsync();

            var filtered = items
                .Select(item =>
                {
                    var primaryValue = GetPrimaryAttributeValueAsString(item);
                    return (Item: item, PrimaryValue: primaryValue);
                })
                .Where(x => !string.IsNullOrEmpty(x.PrimaryValue) &&
                            x.PrimaryValue!.ToLower().Contains(searchText))
                .OrderBy(x => x.PrimaryValue)
                .Take(10)
                .Select(x => x.Item)
                .ToList();

            return filtered;
        }

        protected override ItemProvided MapToEntity(ItemRequired required, ItemProvided? entity = null)
        {
            if (entity == null)
            {
                var newEntity = new ItemProvided(
                    required.CollectionId,
                    required.Quantity,
                    required.Image,
                    required.Description,
                    required.PrivateNote
                );

                foreach (var attr in required.ItemAttributes)
                {
                    newEntity.ItemAttributes.Add(new ItemAttribute
                    {
                        AttributeId = attr.AttributeId,
                        ValueString = attr.ValueString,
                        ValueNumber = attr.ValueNumber,
                        ValueDate = attr.ValueDate,
                        ValueBoolean = attr.ValueBoolean
                    });
                }

                foreach (var tag in required.ItemTags)
                {
                    newEntity.ItemTags.Add(new ItemTags
                    {
                        Tag = tag.Tag
                    });
                }

                return newEntity;
            }

            entity.CollectionId = required.CollectionId;
            entity.Description = required.Description;
            entity.Quantity = required.Quantity;
            entity.Image = required.Image;
            entity.PrivateNote = required.PrivateNote;

            foreach (var attr in required.ItemAttributes)
            {
                var existing = entity.ItemAttributes.FirstOrDefault(x => x.AttributeId == attr.AttributeId);
                if (existing != null)
                {
                    existing.ValueString = attr.ValueString;
                    existing.ValueNumber = attr.ValueNumber;
                    existing.ValueDate = attr.ValueDate;
                    existing.ValueBoolean = attr.ValueBoolean;
                }
                else
                {
                    entity.ItemAttributes.Add(new ItemAttribute
                    {
                        AttributeId = attr.AttributeId,
                        ValueString = attr.ValueString,
                        ValueNumber = attr.ValueNumber,
                        ValueDate = attr.ValueDate,
                        ValueBoolean = attr.ValueBoolean
                    });
                }
            }

            entity.ItemAttributes
                .Where(x => !required.ItemAttributes.Any(a => a.AttributeId == x.AttributeId))
                .ToList()
                .ForEach(x => entity.ItemAttributes.Remove(x));

            foreach (var tag in required.ItemTags)
            {
                var existingTag = entity.ItemTags.FirstOrDefault(t => t.Tag == tag.Tag);
                if (existingTag == null)
                {
                    entity.ItemTags.Add(new ItemTags
                    {
                        Tag = tag.Tag
                    });
                }
            }

            entity.ItemTags
                .Where(t => !required.ItemTags.Any(rt => rt.Tag == t.Tag))
                .ToList()
                .ForEach(t => entity.ItemTags.Remove(t));

            return entity;
        }

        protected override ItemProvided MapToEntity(ItemProvided provided, ItemProvided? entity = null)
        {
            if (entity == null)
            {
                var newEntity = new ItemProvided(
                    provided.CollectionId,
                    provided.Quantity,
                    provided.Image,
                    provided.Description,
                    provided.PrivateNote
                );

                newEntity.Collection = provided.Collection;

                foreach (var attr in provided.ItemAttributes)
                {
                    newEntity.ItemAttributes.Add(attr);
                }

                foreach (var tag in provided.ItemTags)
                {
                    newEntity.ItemTags.Add(tag);
                }

                foreach (var reaction in provided.Reactions)
                {
                    newEntity.Reactions.Add(reaction);
                }

                return newEntity;
            }
            return provided;
        }

        public async Task<IEnumerable<ItemProvided>> GetItemsByCollectionAsync(Guid collectionId)
        {
            IQueryable<ItemProvided> query = _dbSet;

            var includes = includeProvider.GetDefaultIncludes();

            if (includes != null)
            {
                foreach (var include in includes)
                {
                    query = query.Include(include);
                }
            }

            return await query
                .Where(i => i.CollectionId == collectionId)
                .ToListAsync();
        }
    }
}
