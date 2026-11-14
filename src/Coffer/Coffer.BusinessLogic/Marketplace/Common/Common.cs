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

    /// <summary>Business-rule violation; mapped to 400/401/403/404/409/503 by MarketplaceExceptionFilter.</summary>
    public sealed class MarketplaceException : Exception
    {
        public MarketplaceError Error { get; }
        /// <summary>Optional machine-readable code the app reacts to (e.g. "terms_required").</summary>
        public string? Code { get; }

        public MarketplaceException(MarketplaceError error, string message, string? code = null) : base(message)
        {
            Error = error;
            Code = code;
        }

        public static MarketplaceException Validation(string message) => new(MarketplaceError.Validation, message);
        public static MarketplaceException Forbidden(string message = "You are not allowed to do this.") => new(MarketplaceError.Forbidden, message);
        public static MarketplaceException NotFound(string what = "Not found.") => new(MarketplaceError.NotFound, what);
        public static MarketplaceException Conflict(string message) => new(MarketplaceError.Conflict, message);
        public static MarketplaceException Unavailable(string message, string? code = null) => new(MarketplaceError.Unavailable, message, code);
        public static MarketplaceException Unauthorized(string message, string? code = null) => new(MarketplaceError.Unauthorized, message, code);
    }
}
