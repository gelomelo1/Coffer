using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.EntityFrameworkCore;

namespace Coffer.BusinessLogic.Services
{
    public class TradeCleanupService : BackgroundService, ITradeCleanupService
    {
        private readonly IServiceScopeFactory _scopeFactory;

        public TradeCleanupService(IServiceScopeFactory scopeFactory)
        {
            _scopeFactory = scopeFactory;
        }

        public async Task CleanUpTradesAsync()
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<CofferDbContext>();

            var twoWeeksAgo = DateTime.UtcNow.AddDays(-14);

            var tradesToDelete = await db.Trades
                .Include(t => t.Offers)
                .Where(t => t.Offers.Any(o =>
                    (o.Status == "accepted" || o.Status == "revertByCreator" || o.Status == "revertByOfferer")
                    && o.UpdatedAt < twoWeeksAgo))
                .ToListAsync();

            if (tradesToDelete.Any())
            {
                db.Trades.RemoveRange(tradesToDelete);
                await db.SaveChangesAsync();
            }
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                var now = DateTime.Now;
                var midnight = now.Date.AddDays(1);
                var delay = midnight - now;

                await Task.Delay(delay, stoppingToken);

                await CleanUpTradesAsync();
            }
        }
    }
}
