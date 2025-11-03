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

            // If the offer was marked as "traded", delete all other offers
            if (string.Equals(offerStatus, "traded", StringComparison.OrdinalIgnoreCase))
            {
                var otherOffers = await _dbSet
                    .Where(x => x.TradeId == entity.TradeId && x.Id != id)
                    .ToListAsync();

                if (otherOffers.Count > 0)
                {
                    _dbSet.RemoveRange(otherOffers);
                    await _dbContext.SaveChangesAsync();
                }
            }

            IQueryable<OfferProvided> query = _dbSet;

            var includes = _includeProvider?.GetDefaultIncludes();
            if (includes != null && includes.Length > 0)
            {
                foreach (var include in includes)
                    query = query.Include(include);
            }

            var reloaded = await query.FirstOrDefaultAsync(o => o.Id == id);

            return reloaded;
        }

        public async Task<OfferProvided> UpdateOfferAsync(Guid offerId, OfferRequired updated)
        {
            var existing = await _dbSet
                .Include(o => o.OfferItems)
                    .ThenInclude(oi => oi.Item)
                .FirstOrDefaultAsync(o => o.Id == offerId);

            if (existing == null)
                throw new InvalidOperationException($"Offer {offerId} not found.");

            // Apply updates
            existing = MapToEntity(updated, existing);

            await _dbContext.SaveChangesAsync();

            // Detach to avoid tracking conflicts
            _dbContext.Entry(existing).State = EntityState.Detached;

            // Reload fresh with includes
            IQueryable<OfferProvided> query = _dbSet.AsNoTracking();

            var includes = _includeProvider?.GetDefaultIncludes();
            if (includes != null && includes.Length > 0)
            {
                foreach (var include in includes)
                    query = query.Include(include);
            }

            // Ensure OfferItems + Item are always included
            query = query
                .Include(o => o.OfferItems)
                    .ThenInclude(oi => oi.Item);

            var reloaded = await query.FirstOrDefaultAsync(o => o.Id == offerId);

            if (reloaded == null)
                throw new InvalidOperationException($"Offer {offerId} could not be reloaded.");

            return reloaded;
        }

        protected override OfferProvided MapToEntity(OfferRequired required, OfferProvided? entity = null)
        {
            if (entity == null)
            {
                var newEntity = new OfferProvided(required.TradeId, required.UserId, required.MoneyOffer, required.Status);

                foreach (var offerItem in required.OfferItems)
                {
                    newEntity.OfferItems.Add(new OfferItem
                    {
                        OfferId = newEntity.Id,
                        ItemId = offerItem.ItemId
                    });
                }

                return newEntity;
            }

            // --- Update existing entity fields ---
            entity.TradeId = required.TradeId;
            entity.UserId = required.UserId;
            entity.MoneyOffer = required.MoneyOffer;
            entity.Status = required.Status;

            // --- Sync OfferItems ---
            var incomingItemIds = required.OfferItems
                .Where(oi => oi.ItemId.HasValue)
                .Select(oi => oi.ItemId!.Value)
                .ToHashSet();

            // Remove missing
            var toRemove = entity.OfferItems
                .Where(oi => !oi.ItemId.HasValue || !incomingItemIds.Contains(oi.ItemId.Value))
                .ToList();

            foreach (var oi in toRemove)
                entity.OfferItems.Remove(oi);

            // Add new
            foreach (var incoming in required.OfferItems)
            {
                if (!entity.OfferItems.Any(oi => oi.ItemId == incoming.ItemId))
                {
                    entity.OfferItems.Add(new OfferItem
                    {
                        OfferId = entity.Id,
                        ItemId = incoming.ItemId
                    });
                }
            }

            return entity;
        }

        protected override OfferProvided MapToEntity(OfferProvided provided, OfferProvided? entity = null)
        {
            throw new NotImplementedException();
        }
    }
}
