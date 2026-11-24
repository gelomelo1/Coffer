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
            }).AddJsonOptions(options => LocalizedJson.Configure(options.JsonSerializerOptions));
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

            // Accept-Language picks the UI language for translated reference names (any language; English
            // default). Number/date formatting stays English so error messages and payloads don't change.
            app.UseRequestLocalization(new RequestLocalizationOptions
            {
                DefaultRequestCulture = new Microsoft.AspNetCore.Localization.RequestCulture("en"),
                SupportedCultures = new[] { new System.Globalization.CultureInfo("en") },
                SupportedUICultures = System.Globalization.CultureInfo.GetCultures(System.Globalization.CultureTypes.NeutralCultures)
                    .Where(c => !string.IsNullOrEmpty(c.Name)).ToList(),
            });

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

        /// <summary>
        /// Fills My activity from existing dated data, once (after the dev seed, so seeded data is included). A failure
        /// (e.g. the activity_log migration not applied yet) is logged and retried on the next start, never fatal.
        /// </summary>
        /// <summary>Copies the icons that shipped in wwwroot/icons into the icon store (AppPaths.Icons) when missing.</summary>
        public static WebApplication SeedItemTypeIcons(this WebApplication app)
        {
            try
            {
                var copied = Coffer.BusinessLogic.ItemTypes.IconSeed.CopyMissing(
                    Path.Combine(app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot"), "icons"),
                    Coffer.BusinessLogic.ItemTypes.ItemTypeFiles.IconsFolder);
                if (copied > 0) app.Logger.LogInformation("Copied {Count} item type icon(s) into the icon store.", copied);
            }
            catch (Exception e)
            {
                app.Logger.LogWarning(e, "Item type icons were not copied into the icon store.");
            }
            return app;
        }

        public static WebApplication RunActivityBackfill(this WebApplication app)
        {
            try
            {
                using var scope = app.Services.CreateScope();
                var added = scope.ServiceProvider.GetRequiredService<Coffer.BusinessLogic.Activity.IActivityBackfill>()
                    .RunAsync().GetAwaiter().GetResult();
                if (added > 0) app.Logger.LogInformation("Activity log filled from existing data: {Count} entries.", added);
            }
            catch (Exception e)
            {
                app.Logger.LogWarning(e, "Activity log fill skipped; it will be retried on the next start.");
            }
            return app;
        }
    }
}
