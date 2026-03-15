using System.Text;
using Coffer.BusinessLogic.Services;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess;
using Coffer.DataAccess.Extensions.IncludeProviders;
using Coffer.DataAccess.Extensions.IncludeProviders.Interfaces;
using Coffer.DataAccess.Repositories;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using DotNetEnv;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Attribute = Coffer.Domain.Entities.Attribute;

namespace Coffer.Infrastructure
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddInfrastructure(this IServiceCollection services)
        {
            #region AddDatabaseConnection
            services.AddDbContext<CofferDbContext>(options => options.UseNpgsql(Env.GetString("COFFER_CONNECTIONSTRING") ?? throw new InvalidOperationException("COFFER_CONNECTIONSTRING envionmental variable is not set"))
                                                        .UseSnakeCaseNamingConvention());
            #endregion

            #region AddAuthentication
            services.AddAuthentication("Bearer")
                .AddJwtBearer("Bearer", options =>
                {
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidateAudience = true,
                        ValidateLifetime = true,
                        ValidateIssuerSigningKey = true,
                        ValidIssuer = "coffer.backend",
                        ValidAudience = "coffer.backend",
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Env.GetString("JWT_SECRET") ?? throw new InvalidOperationException("JWT_SECRET envionmental variable is not set")))
                    };
                });
            services.AddAuthorization();
            #endregion

            #region AddServices
            services.AddScoped<IJwtService, JwtService>();
            services.AddScoped<IGithubService, GithubService>();
            services.AddScoped<IImageService, ImageService>();
            services.AddMemoryCache();
            services.AddSingleton<ITempTokenService, TempTokenService>();
            services.AddHttpClient();
            services.AddHostedService<TradeCleanupService>();
            services.AddScoped<ITradeCleanupService, TradeCleanupService>();
            services.AddScoped<IPermissionService<Guid, CollectionRequired>, CollectionPermissionService>();
            services.AddScoped<IPermissionService<Guid, FollowRequired>, FollowPermissionService>();
            services.AddScoped<IPermissionService<Guid, ItemRequired>, ItemPermissionService>();
            services.AddScoped<IPermissionService<Guid, OfferProvided>, AllowAllPermissionService<Guid, OfferProvided>>();
            services.AddScoped<IPermissionService<Guid, ReactionRequired>, ReactionPermissionService>();
            services.AddScoped<IPermissionService<Guid, TradeReviewRequired>, AllowAllPermissionService<Guid, TradeReviewRequired>>();
            services.AddScoped<IPermissionService<Guid, TradeRequired>, AllowAllPermissionService<Guid, TradeRequired>>();
            services.AddScoped<IPermissionService<Guid, UserContactRequired>, UserContactPermissionService>();
            services.AddScoped<IPermissionService<Guid, UserRequired>, UserPermissionService>();


            #endregion

            #region AddIncludes
            services.AddScoped<IIncludeProvider<CollectionTypeProvided>, CollectionTypeProvidedIncludeProvider>();
            services.AddScoped<IIncludeProvider<ItemProvided>, ItemIncludeProvider>();
            services.AddScoped<IIncludeProvider<CollectionProvided>, CollectionIncludeProvider>();
            services.AddScoped<IIncludeProvider<User>, UserIncludeProvider>();
            services.AddScoped<IIncludeProvider<TradeProvided>, TradeIncludeProvider>();
            services.AddScoped<IIncludeProvider<OfferProvided>, OfferIncludeProvider>();
            services.AddScoped<IIncludeProvider<TradeReviewProvided>, TradeReviewIncludeProvider>();
            #endregion

            #region AddRepositories
            services.AddScoped<IUsersRepository, UsersRepository>();
            services.AddScoped<IReadOnlyGenericRepository<int, CollectionTypeProvided, CollectionTypeProvided>, CollectionTypesRepository>();
            services.AddScoped<ICollectionsRepository, CollectionsRepository>();
            services.AddScoped<IItemsRepository, ItemsRepository>();
            services.AddScoped<IReadOnlyGenericRepository<int, ItemOptions, ItemOptions>, ItemOptionsRepository>();
            services.AddScoped<IReadOnlyGenericRepository<int, Attribute, Attribute>, AttributesRepository>();
            services.AddScoped<IReactionsRepository, ReactionsRepository>();
            services.AddScoped<IFollowsRepository, FollowsRepository>();
            services.AddScoped<IItemTagsRepository, ItemTagsRepository>();
            services.AddScoped<IGenericRepository<Guid, UserContactProvided, UserContactProvided, UserContactRequired>, UserContactsRepository>();
            services.AddScoped<ITradesRepository, TradesRepository>();
            services.AddScoped<IOffersRepository, OffersRepository>();
            services.AddScoped<ITradeReviewRepository, TradeReviewsRepository>();
            #endregion

            return services;
        }
    }
}
