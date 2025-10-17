using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Dynamic.Core;
using System.Text;
using System.Threading.Tasks;
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
        public ItemsRepository(CofferDbContext dbContext, IIncludeProvider<ItemProvided> includeProvider) : base(dbContext, includeProvider)
        {
        }

        public async Task<IDbContextTransaction> BeginTransactionAsync()
        {
            return await _dbContext.Database.BeginTransactionAsync();
        }

        public async Task<IEnumerable<ItemProvided>> GetFeedItemsAsync(User user)
        {
            var oneWeekAgo = DateTime.UtcNow.AddDays(-7);
            var random = new Random();

            var query = _dbSet
                .Include(i => i.Reactions)
                .Include(i => i.ItemAttributes)
                .ThenInclude(ia => ia.Attribute)
                .Include(i => i.ItemTags)
                .Include(i => i.Collection)
                .Include(i => i.Collection.Follows)
                .Where(i =>
                    i.Collection.UserId != user.Id &&
                    i.AcquiredAt >= oneWeekAgo)
                .Select(i => new
                {
                    Item = i,
                    Score =
                        (i.Collection.Follows.Any(f => f.UserId == user.Id) ? 100 : 0) +   // followed = big weight
                        (i.Collection.User.Country == user.Country ? 50 : 0) + // same country = medium weight
                        random.NextDouble() * 20 // small random for soft mixing
                });

            var items = await query
                .OrderByDescending(x => x.Score)
                .ThenByDescending(x => x.Item.AcquiredAt)
                .Select(x => x.Item)
                .ToListAsync();

            return items;
        }

        protected override ItemProvided MapToEntity(ItemRequired required, ItemProvided? entity = null)
        {
            if (entity == null)
            {
                // New entity
                var newEntity = new ItemProvided(
                    required.CollectionId,
                    required.Description,
                    required.Quantity,
                    required.Image
                );

                // Add attributes
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

                // Add tags
                foreach (var tag in required.ItemTags)
                {
                    newEntity.ItemTags.Add(new ItemTags
                    {
                        Tag = tag.Tag
                    });
                }

                return newEntity;
            }

            // Update simple properties
            entity.CollectionId = required.CollectionId;
            entity.Description = required.Description;
            entity.Quantity = required.Quantity;
            entity.Image = required.Image;

            // Merge ItemAttributes
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

            // Remove attributes that are no longer present
            entity.ItemAttributes
                .Where(x => !required.ItemAttributes.Any(a => a.AttributeId == x.AttributeId))
                .ToList()
                .ForEach(x => entity.ItemAttributes.Remove(x));

            // Merge ItemTags
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

            // Remove tags that are no longer present
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
                // New entity
                var newEntity = new ItemProvided(
                    provided.CollectionId,
                    provided.Description,
                    provided.Quantity,
                    provided.Image
                );

                // Add collection
                newEntity.Collection = provided.Collection;

                // Add attributes
                foreach (var attr in provided.ItemAttributes)
                {
                    newEntity.ItemAttributes.Add(attr);
                }

                // Add tags
                foreach (var tag in provided.ItemTags)
                {
                    newEntity.ItemTags.Add(tag);
                }

                // Add reactions
                foreach (var reaction in provided.Reactions)
                {
                    newEntity.Reactions.Add(reaction);
                }

                return newEntity;
            }
            return provided;
        }
    }
}
