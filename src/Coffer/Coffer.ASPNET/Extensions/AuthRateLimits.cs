using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace Coffer.ASPNET.Extensions
{
    /// <summary>
    /// Per-client-IP limits on the anonymous sign-in endpoints (the IP is the real one behind nginx, see
    /// ForwardedHeadersSetup). Sign-in steps: 20 a minute; refreshing: 60 a minute.
    /// </summary>
    public static class AuthRateLimits
    {
        public const string SignIn = "auth";
        public const string Refresh = "auth-refresh";
        public const string TooManyCode = "tooManyAuthRequests";

        public static IServiceCollection AddAuthRateLimits(this IServiceCollection services) =>
            services.AddRateLimiter(options =>
            {
                options.AddPolicy(SignIn, context => PerIp(context, 20));
                options.AddPolicy(Refresh, context => PerIp(context, 60));
                options.OnRejected = async (context, token) =>
                {
                    context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                    await context.HttpContext.Response.WriteAsJsonAsync(new
                    {
                        message = "Too many sign-in attempts. Wait a minute and try again.",
                        code = TooManyCode,
                    }, token);
                };
            });

        private static RateLimitPartition<string> PerIp(HttpContext context, int permitsPerMinute) =>
            RateLimitPartition.GetFixedWindowLimiter(
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = permitsPerMinute,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                });
    }
}
