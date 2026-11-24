using Coffer.BusinessLogic.Marketplace;
using Coffer.BusinessLogic.Marketplace.Cities;
using Coffer.BusinessLogic.Marketplace.Deals;
using Coffer.BusinessLogic.Marketplace.Reports;
using Coffer.BusinessLogic.Marketplace.Terms;
using Coffer.BusinessLogic.Marketplace.Reviews;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Marketplace.Listings;
using Coffer.BusinessLogic.Marketplace.Messaging;
using Coffer.BusinessLogic.Marketplace.Reputation;
using DotNetEnv;
using Microsoft.Extensions.DependencyInjection;

namespace Coffer.Infrastructure
{
    public static class MarketplaceRegistration
    {
        public static IServiceCollection AddMarketplace(this IServiceCollection services)
        {
            services.AddSingleton<IClock, SystemClock>();
            services.AddSingleton(_ =>
            {
                var root = Coffer.BusinessLogic.AppConfig.AppPaths.Images;
                return new MarketplaceStorage(Path.Combine(root, "listings"), Path.Combine(root, "deals"));
            });
            services.AddHttpClient<ICityService, CityService>();
            services.AddScoped<IListingService, ListingService>();
            services.AddScoped<IConversationSubjectPolicy, ListingConversationPolicy>();
            services.AddScoped<IConversationService, ConversationService>();
            services.AddScoped<ResponsivenessService>();
            services.AddScoped<IDealService, DealService>();
            services.AddScoped<TermsService>();
            services.AddScoped<ReportSnapshotBuilder>();
            services.AddScoped<IReportService, ReportService>();
            services.AddScoped<IAdminReportService, AdminReportService>();
            services.AddScoped<ReviewService>();
            services.AddScoped<IReviewService>(sp => sp.GetRequiredService<ReviewService>());
            services.AddScoped<IMarketplaceSweep>(sp => sp.GetRequiredService<ReviewService>());
            services.AddHostedService<MarketplaceMaintenanceService>();
            return services;
        }
    }
}
