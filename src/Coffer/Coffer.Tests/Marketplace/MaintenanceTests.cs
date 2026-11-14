using Microsoft.Extensions.DependencyInjection;

namespace Coffer.Tests.Marketplace
{
    [Collection("api")]
    public class MaintenanceTests : IDisposable
    {
        private readonly ApiFactory _api = new();

        [Fact]
        public async Task MaintenanceSweep_ResolvesAllServicesFromContainer()
        {
            _ = _api.CreateClient(); // builds the host
            var sweeper = new Coffer.BusinessLogic.Marketplace.MarketplaceMaintenanceService(
                _api.Services.GetRequiredService<IServiceScopeFactory>());

            await sweeper.RunOnceAsync(); // must not throw (DI graph + queries on an empty db)
        }

        public void Dispose() => _api.Dispose();
    }
}
