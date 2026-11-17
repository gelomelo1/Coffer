using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Extensions
{
    /// <summary>
    /// The one error body the API returns: <c>{ code, params, message }</c>. The app translates <c>code</c>
    /// (errors:backend.&lt;code&gt;) with <c>params</c>; <c>message</c> is the English text for other clients and logs.
    /// </summary>
    public static class ApiErrorExtensions
    {
        public static object Payload(string code, string message, IReadOnlyDictionary<string, string>? args) =>
            new { code, @params = args, message };

        /// <summary>Error result from a controller, e.g. <c>return this.ApiError(400, "searchTextCannotBeEmpty", "Search text cannot be empty.");</c></summary>
        public static ObjectResult ApiError(this ControllerBase controller, int status, string code, string message, IReadOnlyDictionary<string, string>? args = null) =>
            new(Payload(code, message, args)) { StatusCode = status };
    }
}
