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
    public class OffersRepository : GenericRepository<Guid, OfferProvided, OfferProvided, OfferRequired>, IOffersRepository
    {
        public OffersRepository(CofferDbContext dbContext, IIncludeProvider<OfferProvided>? includeProvider = null) : base(dbContext, includeProvider)
        {
        }

        public async Task<OfferProvided?> ChangeOfferStatus(Guid id, string offerStatus)
        {
            var entity = await _dbSet.FirstOrDefaultAsync(x => x.Id == id);
            if (entity == null)
            {
                return null;
            }
            entity.Status = offerStatus;
            entity.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync();
            return entity;
        }

        protected override OfferProvided MapToEntity(OfferRequired required, OfferProvided? entity = null)
        {
            if(entity == null)
            {
                var newEntity = new OfferProvided(required.TradeId, required.UserId, required.MoneyOffer, required.Status);

                foreach(var offerItems in required.OfferItems)
                {
                    var newOfferItems = new OfferItem
                    {
                        OfferId = offerItems.OfferId,
                        ItemId = offerItems.ItemId,
                    };
                    newEntity.OfferItems.Add(newOfferItems);
                }

                return newEntity;
            }

            entity.TradeId = required.TradeId;
            entity.UserId = required.UserId;
            entity.MoneyOffer = required.MoneyOffer;
            entity.Status = required.Status;
            entity.UpdatedAt = DateTime.UtcNow;

            // Merge offerItems
            foreach (var offerItem in required.OfferItems)
            {
                // Match only by Id if available
                var existing = offerItem.Id != Guid.Empty
                    ? entity.OfferItems.FirstOrDefault(x => x.Id == offerItem.Id)
                    : null;

                if (existing != null)
                {
                    // Update existing fields
                    existing.OfferId = offerItem.Id;
                    existing.ItemId = offerItem.ItemId;
                    existing.Item = offerItem.Item;
                }
                else
                {
                    // Add new offerItem
                    entity.OfferItems.Add(new OfferItem
                    {
                        OfferId = entity.Id,
                        ItemId = offerItem.ItemId,
                        Item = offerItem.Item
                    });
                }
            }

            // Remove offerItems that are no longer present (match only those with valid Id)
            entity.OfferItems
                .Where(x => x.Id != Guid.Empty && !required.OfferItems.Any(t => t.Id == x.Id))
                .ToList()
                .ForEach(x => entity.OfferItems.Remove(x));

            return entity;
        }

        protected override OfferProvided MapToEntity(OfferProvided provided, OfferProvided? entity = null)
        {
            throw new NotImplementedException();
        }
    }
}
