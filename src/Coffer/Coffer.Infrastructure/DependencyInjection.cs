using System.Text;
using Coffer.BusinessLogic.Services;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess;
using Coffer.DataAccess.Repositories;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using DotNetEnv;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

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
            #endregion

            #region AddRepositories
            services.AddScoped<IUsersRepository, UsersRepository>();
            services.AddScoped<IGenericRepository<Guid, CollectionTypeProvided, CollectionTypeProvided, CollectionTypeRequired>, CollectionTypesRepository>();
            services.AddScoped<IGenericRepository<Guid, CollectionProvided, CollectionProvided, CollectionRequired>, CollectionsRepository>();
            #endregion

            return services;
        }
    }
}
