using System.Security.Claims;
using Coffer.BusinessLogic.Moderation;

namespace Coffer.ASPNET.Extensions
{
    /// <summary>
    /// Enforces temporary suspensions on the server for every request made with a Coffer user token — including
    /// tokens issued before the suspension (they live a year), so signing in again doesn't help. The only exception
    /// is GET api/Account/Suspension, which tells the app why and until when.
    /// </summary>
    public sealed class SuspensionEnforcementMiddleware
    {
        private readonly RequestDelegate _next;

        public SuspensionEnforcementMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context, ISuspensionService suspensions)
        {
            // context.User comes from the default "Bearer" scheme (user tokens only; Manager tokens use another scheme).
            var userId = context.User.Identity?.IsAuthenticated == true
                ? context.User.FindFirstValue(ClaimTypes.NameIdentifier)
                : null;

            if (Guid.TryParse(userId, out var id) && !IsExempt(context.Request))
            {
                var active = await suspensions.GetActiveAsync(id);
                if (active != null)
                {
                    await WriteSuspendedAsync(context.Response, active);
                    return;
                }
            }

            await _next(context);
        }

        private static bool IsExempt(HttpRequest request) =>
            HttpMethods.IsGet(request.Method) && request.Path.Equals("/api/Account/Suspension", StringComparison.OrdinalIgnoreCase);

        public static Task WriteSuspendedAsync(HttpResponse response, ActiveSuspensionDto active)
        {
            response.StatusCode = StatusCodes.Status403Forbidden;
            return response.WriteAsJsonAsync(new
            {
                message = $"Your account is suspended until {active.EndsAt:yyyy-MM-dd HH:mm} UTC.",
                code = SuspensionService.SuspendedCode,
                reason = active.Reason,
                startsAt = active.StartsAt,
                endsAt = active.EndsAt,
            });
        }
    }
}
