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
            // App user tokens: 15-minute HS256 access tokens of a live session (checked per request by the
            // SuspensionEnforcementMiddleware). The key comes from AuthOptions (JWT_SECRET, 32+ bytes).
            services.AddAuthentication("Bearer")
                .AddJwtBearer("Bearer", _ => { })
                .AddManagerAuthentication();
            services.AddOptions<Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerOptions>("Bearer")
                .Configure<Coffer.BusinessLogic.Auth.AuthOptions>((options, auth) =>
                    options.TokenValidationParameters = Coffer.BusinessLogic.Auth.Sessions.AccessTokenIssuer.ValidationParameters(auth.JwtKey));
            services.AddAuthorization();
            services.AddModeration();
            #endregion

            #region SetupSwagger
            services.AddSwaggerGen(options =>
                {
                options.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
                {
                    Name = "Authorization",
                    Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
                    Scheme = "bearer",
                    BearerFormat = "JWT",
                    In = Microsoft.OpenApi.Models.ParameterLocation.Header,
                    Description = "Enter 'Bearer' [space] and then your valid token.\n\nExample: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                });

                options.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            new string[] {}
        }
    });
            });
            #endregion

            #region AddServices
            // Every sign-in setting is required; resolved once at startup (SetupMiddleware) so a missing one stops the API.
            services.AddSingleton(_ => Coffer.BusinessLogic.Auth.AuthOptions.FromEnvironment(Environment.GetEnvironmentVariable));
            services.AddSingleton<Coffer.BusinessLogic.Auth.Sessions.AccessTokenIssuer>();
            services.AddSingleton<Coffer.BusinessLogic.Auth.Sessions.SessionGuardCache>();
            services.AddScoped<Coffer.BusinessLogic.Auth.Sessions.ISessionService, Coffer.BusinessLogic.Auth.Sessions.SessionService>();
            services.AddScoped<IGithubService, GithubService>();
            services.AddScoped<IImageService, ImageService>();
            services.AddMemoryCache();
            services.AddSingleton<ITempTokenService, TempTokenService>();
            services.AddHttpClient();
            services.AddMarketplace();
            services.AddScoped<IPermissionService<Guid, CollectionRequired>, CollectionPermissionService>();
            services.AddScoped<IPermissionService<Guid, FollowRequired>, FollowPermissionService>();
            services.AddScoped<IPermissionService<Guid, ItemRequired>, ItemPermissionService>();
            services.AddScoped<IPermissionService<Guid, ReactionRequired>, ReactionPermissionService>();
            services.AddScoped<IPermissionService<Guid, UserRequired>, UserPermissionService>();


            #endregion

            #region AddIncludes
            services.AddScoped<IIncludeProvider<CollectionTypeProvided>, CollectionTypeProvidedIncludeProvider>();
            services.AddScoped<IIncludeProvider<ItemProvided>, ItemIncludeProvider>();
            services.AddScoped<IIncludeProvider<CollectionProvided>, CollectionIncludeProvider>();
            services.AddScoped<IIncludeProvider<User>, UserIncludeProvider>();
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
            #endregion

            return services;
        }
    }
}
