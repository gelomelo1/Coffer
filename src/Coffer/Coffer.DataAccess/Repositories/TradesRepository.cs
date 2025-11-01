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

namespace Coffer.DataAccess.Repositories
{
    public class TradesRepository : GenericRepository<Guid, TradeProvided, TradeProvided, TradeRequired>, ITradesRepository
    {
        public TradesRepository(CofferDbContext dbContext, IIncludeProvider<TradeProvided>? includeProvider = null)
            : base(dbContext, includeProvider)
        {
        }

        protected override TradeProvided MapToEntity(TradeRequired required, TradeProvided? entity = null)
        {
            if (entity == null)
            {
                var newEntity = new TradeProvided(required.UserId, required.Title, required.Description, required.WantDescription, required.MoneyRequested);

                foreach (var tradeItem in required.TradeItems)
                {
                    newEntity.TradeItems.Add(new TradeItem
                    {
                        ItemId = tradeItem.ItemId
                    });
                }

                return newEntity;
            }

            // Update fields
            entity.UserId = required.UserId;
            entity.Title = required.Title;
            entity.Description = required.Description;
            entity.WantDescription = required.WantDescription;
            entity.MoneyRequested = required.MoneyRequested;
            entity.UpdatedAt = DateTime.UtcNow;

            // --- Update TradeItems ---
            var incomingItemIds = required.TradeItems
                .Where(ti => ti.ItemId.HasValue)
                .Select(ti => ti.ItemId!.Value)
                .ToHashSet();

            // Remove missing
            var toRemove = entity.TradeItems
                .Where(ti => !ti.ItemId.HasValue || !incomingItemIds.Contains(ti.ItemId.Value))
                .ToList();

            foreach (var ti in toRemove)
                entity.TradeItems.Remove(ti);

            // Add new
            foreach (var incoming in required.TradeItems)
            {
                if (!entity.TradeItems.Any(ti => ti.ItemId == incoming.ItemId))
                {
                    entity.TradeItems.Add(new TradeItem
                    {
                        TradeId = entity.Id,
                        ItemId = incoming.ItemId
                    });
                }
            }

            return entity;
        }

        // This override is required by the generic repository but unused here
        protected override TradeProvided MapToEntity(TradeProvided provided, TradeProvided? entity = null)
        {
            throw new NotImplementedException();
        }
        public async Task<TradeProvided> UpdateTradeAsync(Guid tradeId, TradeRequired updated)
        {
            var existing = await _dbSet
                .Include(t => t.TradeItems)
                    .ThenInclude(ti => ti.Item)
                .FirstOrDefaultAsync(t => t.Id == tradeId);

            if (existing == null)
                throw new InvalidOperationException($"Trade {tradeId} not found.");

            // Apply updates
            existing = MapToEntity(updated, existing);
            await _dbContext.SaveChangesAsync();

            // --- Reload everything fresh from database ---
            _dbContext.Entry(existing).State = EntityState.Detached;

            // Get includes dynamically from provider
            var includes = _includeProvider?.GetDefaultIncludes();

            IQueryable<TradeProvided> query = _dbSet.AsNoTracking();

            if (includes != null)
            {
                foreach (var include in includes)
                {
                    query = query.Include(include);
                }
            }

            var reloaded = await query.FirstOrDefaultAsync(t => t.Id == tradeId);

            if (reloaded == null)
                throw new InvalidOperationException($"Trade {tradeId} could not be reloaded.");

            return reloaded;
        }

        public async Task<IEnumerable<TradeProvided>> GetSearchTradesAsync(Guid userId, string? filter = null, string? orderBy = null, int? page = null, int? pageSize = null)
        {
            IQueryable<TradeProvided> query = _dbSet;

            // Apply default includes dynamically
            var includes = _includeProvider?.GetDefaultIncludes();
            if (includes != null && includes.Length > 0)
            {
                foreach (var include in includes)
                    query = query.Include(include);
            }

            // Exclude trades created by the current user
            query = query.Where(t => t.UserId != userId);

            // Apply optional filter (e.g., Dynamic LINQ)
            if (!string.IsNullOrWhiteSpace(filter))
                query = query.Where(filter);

            // Apply optional custom ordering, otherwise default by CreatedAt descending
            if (!string.IsNullOrWhiteSpace(orderBy))
                query = query.OrderBy(orderBy);
            else
                query = query.OrderByDescending(t => t.CreatedAt);

            // Apply pagination if provided
            if (page.HasValue && pageSize.HasValue)
                query = query.Skip((page.Value - 1) * pageSize.Value).Take(pageSize.Value);

            // Execute the query
            var list = await query.ToListAsync();

            return list;
        }
    }
}
