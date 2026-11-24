namespace Coffer.Domain.Auth
{
    /// <summary>
    /// One refresh token of a session. Only its SHA-256 hash is stored. Single use: refreshing consumes it and issues
    /// the next one; presenting a consumed token again means it was copied, and the whole session is revoked.
    /// </summary>
    public class AuthRefreshToken
    {
        public Guid Id { get; set; }
        public Guid SessionId { get; set; }
        /// <summary>Lowercase hex SHA-256 of the raw token.</summary>
        public string TokenHash { get; set; } = "";
        public DateTime CreatedAt { get; set; }
        /// <summary>Idle limit: 14 days after it was issued, never past the session's own end.</summary>
        public DateTime ExpiresAt { get; set; }
        public DateTime? ConsumedAt { get; set; }
    }
}
