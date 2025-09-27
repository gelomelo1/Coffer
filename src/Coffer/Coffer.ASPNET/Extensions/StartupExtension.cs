using Coffer.Infrastructure;
using DotNetEnv;

namespace Coffer.ASPNET.Extensions
{
    public static class StartupExtension
    {
        public static WebApplicationBuilder SetupServices(this WebApplicationBuilder builder)
        {
            // Add services to the container.

            builder.Services.AddControllers();
            // Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen();

            builder.Services.AddCors(options =>
            {
                options.AddPolicy("AllowFrontend", policy =>
                {
                    policy.WithOrigins(
                        "http://localhost:8081" // Expo dev server (React Native)
                    )
                    .AllowAnyHeader()
                    .AllowAnyMethod();
                });
            });

            Env.Load("../../.env");
            builder.Services.AddInfrastructure();

            return builder;
        }

        public static WebApplication SetupMiddleware(this WebApplication app)
        {
            app.UseDefaultFiles();
            app.UseStaticFiles();

            // Configure the HTTP request pipeline.
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
