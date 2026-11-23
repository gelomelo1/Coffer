using Coffer.BusinessLogic.Community;
using Coffer.BusinessLogic.DevSeed;
using Coffer.BusinessLogic.Moderation;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace Coffer.Infrastructure
{
    /// <summary>Requires a Manager token whose GitHub id is (still) in COFFER_MANAGER_ADMIN_GITHUB_PROVIDER_IDS.</summary>
    public sealed class ManagerAdminRequirement : IAuthorizationRequirement { }

    public sealed class ManagerAdminHandler : AuthorizationHandler<ManagerAdminRequirement>
    {
        private readonly ManagerAdminConfig _config;

        public ManagerAdminHandler(ManagerAdminConfig config)
        {
            _config = config;
        }

        protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, ManagerAdminRequirement requirement)
        {
            var identity = context.User.Identities.FirstOrDefault(i => i.IsAuthenticated && i.AuthenticationType == ManagerTokens.Scheme);
            var githubId = identity?.FindFirst(ManagerTokens.GithubIdClaim)?.Value;
            if (_config.IsAdmin(githubId))
                context.Succeed(requirement);
            return Task.CompletedTask;
        }
    }

    public static class ModerationRegistration
    {
        /// <summary>Second JWT scheme for Coffer.Manager (audience coffer.manager) + the ManagerAdmin policy.</summary>
        public static AuthenticationBuilder AddManagerAuthentication(this AuthenticationBuilder auth) =>
            auth.AddJwtBearer(ManagerTokens.Scheme, options =>
            {
                options.MapInboundClaims = false;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = ManagerTokens.Issuer,
                    ValidAudience = ManagerTokens.Audience,
                    IssuerSigningKey = ManagerTokens.Key(),
                    NameClaimType = ManagerTokens.LoginClaim,
                    AuthenticationType = ManagerTokens.Scheme,
                    ClockSkew = TimeSpan.FromMinutes(1),
                };
            });

        public static IServiceCollection AddModeration(this IServiceCollection services)
        {
            services.AddSingleton(_ => ManagerAdminConfig.FromEnvironment());
            services.AddHttpClient<IGithubDeviceFlowClient, GithubDeviceFlowClient>();
            services.AddScoped<IManagerAuthService, ManagerAuthService>();
            services.AddScoped<ISuspensionService, SuspensionService>();
            services.AddScoped<IItemCommentService, ItemCommentService>();
            services.AddScoped<Coffer.BusinessLogic.Account.IAccountDeletionService, Coffer.BusinessLogic.Account.AccountDeletionService>();
            services.AddScoped<Coffer.BusinessLogic.Account.IDeletedAccounts, Coffer.BusinessLogic.Account.DeletedAccounts>();
            services.AddScoped<IItemRemovalService, ItemRemovalService>();
            services.AddScoped<Coffer.BusinessLogic.Account.IContentTombstoneService, Coffer.BusinessLogic.Account.ContentTombstoneService>();
            services.AddScoped<Coffer.BusinessLogic.Pending.IPendingItemService, Coffer.BusinessLogic.Pending.PendingItemService>();
            services.AddScoped<Coffer.BusinessLogic.Activity.IActivityLog, Coffer.BusinessLogic.Activity.ActivityLog>();
            services.AddScoped<Coffer.BusinessLogic.Activity.IActivityQueryService, Coffer.BusinessLogic.Activity.ActivityQueryService>();
            services.AddScoped<Coffer.BusinessLogic.Activity.IActivityBackfill, Coffer.BusinessLogic.Activity.ActivityBackfill>();
            services.AddScoped<Coffer.BusinessLogic.Community.Stats.ICommunityStatsService, Coffer.BusinessLogic.Community.Stats.CommunityStatsService>();
            services.AddScoped<Coffer.BusinessLogic.News.INewsService, Coffer.BusinessLogic.News.NewsService>();
            services.AddScoped<Coffer.BusinessLogic.ItemTypes.IItemTypeVisibility, Coffer.BusinessLogic.ItemTypes.ItemTypeVisibility>();
            services.AddSingleton<Coffer.BusinessLogic.ItemTypes.IItemTypeFiles, Coffer.BusinessLogic.ItemTypes.ItemTypeFiles>();
            services.AddHttpClient<Coffer.BusinessLogic.ItemTypes.IModelValidator, Coffer.BusinessLogic.ItemTypes.HttpModelValidator>(c => c.Timeout = TimeSpan.FromMinutes(2));
            services.AddScoped<Coffer.BusinessLogic.ItemTypes.IFingerprintRebuilder, Coffer.BusinessLogic.ItemTypes.FingerprintRebuilder>();
            services.AddScoped<Coffer.BusinessLogic.ItemTypes.IItemTypeAdminService, Coffer.BusinessLogic.ItemTypes.ItemTypeAdminService>();
            services.AddScoped<Coffer.BusinessLogic.ItemTypes.IOptionSetAdminService, Coffer.BusinessLogic.ItemTypes.OptionSetAdminService>();
            services.AddScoped<Coffer.BusinessLogic.ItemTypes.IItemTypePublishing, Coffer.BusinessLogic.ItemTypes.ItemTypePublishing>();
            services.AddScoped<Coffer.BusinessLogic.Marketplace.IMarketplaceSweep, Coffer.BusinessLogic.Pending.PendingExpirySweep>();
            services.AddSingleton<IAuthorizationHandler, ManagerAdminHandler>();

            // Development seed / reset (only ever run from the API's startup, and only in Development).
            services.AddHttpClient<IAiImagePipeline, AiImagePipeline>(c => c.Timeout = TimeSpan.FromMinutes(3));
            services.AddScoped<DevDatabaseResetter>();
            services.AddScoped<DevSeeder>();
            services.AddScoped<DevSeedRunner>();
            services.AddScoped<DevLoginService>();
            services.AddAuthorization(options =>
            {
                options.AddPolicy(ManagerTokens.Policy, policy => policy
                    .AddAuthenticationSchemes(ManagerTokens.Scheme)
                    .RequireAuthenticatedUser()
                    .AddRequirements(new ManagerAdminRequirement()));
            });
            return services;
        }
    }
}
