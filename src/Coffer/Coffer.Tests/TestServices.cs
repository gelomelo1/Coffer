using Coffer.DataAccess;
using Coffer.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Coffer.Tests
{
    /// <summary>
    /// Builds the real production DI container (AddInfrastructure) but swaps the
    /// Npgsql DbContext for the test's SQLite context.
    /// </summary>
    public static class TestServices
    {
        static TestServices() => TestEnvironment.Ensure();

        public static IServiceProvider Create(TestDb db)
        {
            var services = new ServiceCollection();
            services.AddLogging();
            services.AddInfrastructure();

            var dbDescriptors = services
                .Where(d => d.ServiceType == typeof(CofferDbContext)
                         || d.ServiceType == typeof(DbContextOptions)
                         || (d.ServiceType.IsGenericType && d.ServiceType.GetGenericArguments().Contains(typeof(CofferDbContext))))
                .ToList();
            foreach (var d in dbDescriptors)
                services.Remove(d);

            services.AddSingleton(db.Context);

            return services.BuildServiceProvider(new ServiceProviderOptions { ValidateOnBuild = false });
        }
    }
}
