using Coffer.Infrastructure;
using DotNetEnv;

namespace Coffer.ASPNET.Extensions
{
    public static class StartupExtension
    {
        public static WebApplicationBuilder SetupServices(this WebApplicationBuilder builder)
        {

            builder.Services.AddControllers();
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
            app.UseAuthorization();


            app.MapControllers();

            app.MapFallbackToFile("/index.html");

            return app;
        }
    }
}
