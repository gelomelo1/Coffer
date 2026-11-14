using Coffer.BusinessLogic.Marketplace.Deals;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Coffer.BusinessLogic.Marketplace
{
    /// <summary>
    /// Hourly sweeper that persists time-based transitions (shipping auto-complete, review publication).
    /// Correctness never depends on it: the same rules are applied lazily whenever the data is read.
    /// </summary>
    public class MarketplaceMaintenanceService : BackgroundService
    {
        private static readonly TimeSpan Interval = TimeSpan.FromHours(1);
        private readonly IServiceScopeFactory _scopes;

        public MarketplaceMaintenanceService(IServiceScopeFactory scopes)
        {
            _scopes = scopes;
        }

        public async Task RunOnceAsync()
        {
            using var scope = _scopes.CreateScope();
            await scope.ServiceProvider.GetRequiredService<IDealService>().ApplyDueTimeRulesAsync();
            foreach (var task in scope.ServiceProvider.GetServices<IMarketplaceSweep>())
                await task.SweepAsync();
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await RunOnceAsync();
                }
                catch (Exception e)
                {
                    Console.WriteLine($"Marketplace maintenance failed: {e.GetType().Name}: {e.Message}");
                }
                await Task.Delay(Interval, stoppingToken);
            }
        }
    }

    /// <summary>Extra periodic work (e.g. publishing reviews whose window ended).</summary>
    public interface IMarketplaceSweep
    {
        Task SweepAsync();
    }
}
