using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.DataAccess.Extensions.IncludeProviders.Interfaces;
using Coffer.DataAccess.Repositories.Generic;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Coffer.DataAccess.Repositories
{
    public class TradesRepository : GenericRepository<Guid, TradeProvided, TradeProvided, TradeRequired>, ITradesRepository
    {
        public TradesRepository(CofferDbContext dbContext, IIncludeProvider<TradeProvided>? includeProvider = null) : base(dbContext, includeProvider)
        {

        }

        protected override TradeProvided MapToEntity(TradeRequired required, TradeProvided? entity = null)
        {
            if(entity == null)
            {
                var newEntity = new TradeProvided(required.UserId, required.Title, required.Description, required.WantDescription, required.MoneyRequested);

                foreach(var tradeItem in required.TradeItems)
                {
                    newEntity.TradeItems.Add(new TradeItem
                    {
                        TradeId = tradeItem.TradeId,
                        ItemId = tradeItem.ItemId,
                    });
                }
                return newEntity;
            }

            entity.UserId = required.UserId;
            entity.Title = required.Title;
            entity.Description = required.Description;
            entity.WantDescription = required.WantDescription;
            entity.MoneyRequested = required.MoneyRequested;
            entity.UpdatedAt = DateTime.UtcNow;

            // Merge TradeItems
            foreach (var tradeItem in required.TradeItems)
            {
                // Match only by Id if available
                var existing = tradeItem.Id != Guid.Empty
                    ? entity.TradeItems.FirstOrDefault(x => x.Id == tradeItem.Id)
                    : null;

                if (existing != null)
                {
                    // Update existing fields
                    existing.TradeId = tradeItem.Id;
                    existing.ItemId = tradeItem.ItemId;
                    existing.Item = tradeItem.Item;
                }
                else
                {
                    // Add new TradeItem
                    entity.TradeItems.Add(new TradeItem
                    {
                        TradeId = entity.Id,
                        ItemId = tradeItem.ItemId,
                        Item = tradeItem.Item
                    });
                }
            }

            // Remove TradeItems that are no longer present (match only those with valid Id)
            entity.TradeItems
                .Where(x => x.Id != Guid.Empty && !required.TradeItems.Any(t => t.Id == x.Id))
                .ToList()
                .ForEach(x => entity.TradeItems.Remove(x));

            return entity;
        }

        protected override TradeProvided MapToEntity(TradeProvided provided, TradeProvided? entity = null)
        {
            throw new NotImplementedException();
        }
    }
}
