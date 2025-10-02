using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Dynamic.Core;
using System.Text;
using System.Threading.Tasks;
using Coffer.DataAccess.Extensions.IncludeProviders.Interfaces;
using Coffer.DataAccess.Repositories.Generic;
using Coffer.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Coffer.DataAccess.Repositories
{
    public class ItemsRepository : GenericRepository<Guid, ItemProvided, ItemProvided, ItemRequired>
    {
        public ItemsRepository(CofferDbContext dbContext, IIncludeProvider<ItemProvided> includeProvider) : base(dbContext, includeProvider)
        {
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
    }
}
