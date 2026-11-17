namespace Coffer.BusinessLogic.Marketplace.Common
{
    public interface IClock
    {
        DateTime UtcNow { get; }
    }

    public sealed class SystemClock : IClock
    {
        public DateTime UtcNow => DateTime.UtcNow;
    }

    public enum MarketplaceError { Validation, Forbidden, NotFound, Conflict, Unavailable, Unauthorized }

    /// <summary>
    /// Business-rule violation; mapped to 400/401/403/404/409/503 by MarketplaceExceptionFilter. Every error carries a
    /// stable <see cref="Code"/> the app translates (errors:backend.&lt;code&gt; or a special code such as
    /// "terms_required") with <see cref="Args"/> for the {{p0}}… placeholders; the English message stays for other
    /// clients and logs.
    /// </summary>
    public sealed class MarketplaceException : Exception
    {
        public MarketplaceError Error { get; }
        public string Code { get; }
        public IReadOnlyDictionary<string, string>? Args { get; }

        public MarketplaceException(MarketplaceError error, string code, string message, IReadOnlyDictionary<string, string>? args = null) : base(message)
        {
            Error = error;
            Code = code;
            Args = args;
        }

        public static MarketplaceException Validation(string code, string message, IReadOnlyDictionary<string, string>? args = null) => new(MarketplaceError.Validation, code, message, args);
        public static MarketplaceException Forbidden(string code, string message, IReadOnlyDictionary<string, string>? args = null) => new(MarketplaceError.Forbidden, code, message, args);
        public static MarketplaceException NotFound(string code, string message, IReadOnlyDictionary<string, string>? args = null) => new(MarketplaceError.NotFound, code, message, args);
        public static MarketplaceException Conflict(string code, string message, IReadOnlyDictionary<string, string>? args = null) => new(MarketplaceError.Conflict, code, message, args);
        public static MarketplaceException Unavailable(string code, string message, IReadOnlyDictionary<string, string>? args = null) => new(MarketplaceError.Unavailable, code, message, args);
        public static MarketplaceException Unauthorized(string code, string message, IReadOnlyDictionary<string, string>? args = null) => new(MarketplaceError.Unauthorized, code, message, args);
    }

    /// <summary>Placeholder values of an error message, named p0, p1… in order (matching the app's {{p0}} texts).</summary>
    public static class ErrorArgs
    {
        public static IReadOnlyDictionary<string, string> Of(params string[] values)
        {
            var args = new Dictionary<string, string>();
            for (var i = 0; i < values.Length; i++) args[$"p{i}"] = values[i];
            return args;
        }
    }
}
