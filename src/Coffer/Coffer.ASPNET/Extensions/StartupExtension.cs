using Coffer.Infrastructure;
using DotNetEnv;

namespace Coffer.ASPNET.Extensions
{
    public static class StartupExtension
    {
        public static WebApplicationBuilder SetupServices(this WebApplicationBuilder builder)
        {

            builder.Services.AddControllers(options =>
            {
                options.Filters.Add<SensitiveDataRedactionFilter>();
                options.Filters.Add<MarketplaceExceptionFilter>();
            });
            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen();

            builder.Services.AddCors(options =>
            {
                options.AddPolicy("AllowFrontend", policy =>
                {
                    policy.WithOrigins(
                        "http://localhost:8081"
                    )
                    .AllowAnyHeader()
                    .AllowAnyMethod();
                });
            });

            var env = builder.Environment;

            Console.WriteLine($"Current ASP.NET Core environment: {env.EnvironmentName}");

            bool envLoaded = false;

            try
            {
                if (env.IsProduction())
                {
                    Env.Load("/var/www/coffer/.env.production");
                    envLoaded = true;
                }
                else if (env.IsDevelopment() && File.Exists("../../.env.development"))
                {
                    // Local development configuration (copy of .env + dev seed / admin settings); never committed.
                    Env.Load("../../.env.development");
                    envLoaded = true;
                }
                else
                {
                    Env.Load("../../.env");
                    envLoaded = true;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to load environment file: {ex.Message}");
            }

            Console.WriteLine(envLoaded
                ? "Environment file loaded successfully."
                : "Environment file was not loaded.");

            builder.Services.AddInfrastructure();

            // Optional shared secret for backend -> Python service calls (set INTERNAL_API_KEY in the .env
            // file of both services to enable it). Only added to requests that go to FASTAPI_URL.
            builder.Services.ConfigureHttpClientDefaults(http =>
                http.AddHttpMessageHandler(() => new InternalApiKeyHandler(
                    Environment.GetEnvironmentVariable("FASTAPI_URL"),
                    Environment.GetEnvironmentVariable("INTERNAL_API_KEY"))));

            return builder;
        }

        public static WebApplication SetupMiddleware(this WebApplication app)
        {
            app.UseDefaultFiles();
            app.UseStaticFiles();

            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI();
            }

            app.UseHttpsRedirection();

            app.UseCors("AllowFrontend");

            app.UseAuthentication();
            // Suspended users are blocked server-side right after their token is read.
            app.UseMiddleware<SuspensionEnforcementMiddleware>();
            app.UseAuthorization();


            app.MapControllers();

            app.MapFallbackToFile("/index.html");

            var managerAdmins = app.Services.GetRequiredService<Coffer.BusinessLogic.Moderation.ManagerAdminConfig>();
            if (managerAdmins.HasAdmins)
                app.Logger.LogInformation("Coffer.Manager: {Count} administrator GitHub id(s) configured.", managerAdmins.Ids.Count);
            else
                app.Logger.LogWarning("Coffer.Manager administrator provisioning required: {Problem}", managerAdmins.Problem);

            return app;
        }
    
        /// <summary>
        /// Development database reset + seed from .env.development (DEV_RESET_DATABASE_ON_STARTUP, DEV_SEED_ENABLED).
        /// Runs before the API accepts requests; throws (and stops startup) when switched on outside Development.
        /// </summary>
        public static WebApplication RunDevelopmentSeed(this WebApplication app)
        {
            Coffer.BusinessLogic.DevSeed.DevSeedGuard.CheckDevLogin(app.Environment.EnvironmentName);
            if (Coffer.BusinessLogic.DevSeed.DevLoginService.IsEnabled(app.Environment.EnvironmentName))
                app.Logger.LogWarning("DEV LOGIN ENABLED: seeded test users can sign in without Google/GitHub (Development only).");

            var options = Coffer.BusinessLogic.DevSeed.DevSeedOptions.FromEnvironment();
            Coffer.BusinessLogic.DevSeed.DevSeedGuard.Check(app.Environment.EnvironmentName, options);
            if (!options.AnythingToDo)
                return app;

            using var scope = app.Services.CreateScope();
            scope.ServiceProvider.GetRequiredService<Coffer.BusinessLogic.DevSeed.DevSeedRunner>()
                .RunAsync(app.Environment.EnvironmentName, options)
                .GetAwaiter().GetResult();
            return app;
        }
    }
}
