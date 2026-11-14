using Coffer.BusinessLogic.Marketplace.Common;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Coffer.ASPNET.Extensions
{
    /// <summary>Maps marketplace business-rule violations to HTTP status codes with a {message} body.</summary>
    public sealed class MarketplaceExceptionFilter : IExceptionFilter
    {
        public void OnException(ExceptionContext context)
        {
            if (context.Exception is not MarketplaceException ex)
                return;

            var status = ex.Error switch
            {
                MarketplaceError.Validation => StatusCodes.Status400BadRequest,
                MarketplaceError.Forbidden => StatusCodes.Status403Forbidden,
                MarketplaceError.NotFound => StatusCodes.Status404NotFound,
                MarketplaceError.Unavailable => StatusCodes.Status503ServiceUnavailable,
                MarketplaceError.Unauthorized => StatusCodes.Status401Unauthorized,
                _ => StatusCodes.Status409Conflict,
            };
            context.Result = new ObjectResult(ex.Code == null ? new { message = ex.Message } : (object)new { message = ex.Message, code = ex.Code })
            {
                StatusCode = status,
            };
            context.ExceptionHandled = true;
        }
    }
}
