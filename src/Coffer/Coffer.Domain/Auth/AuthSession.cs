namespace Coffer.Domain.Auth
{
    /// <summary>
    /// A signed-in device. Every access token carries its id ("sid"); revoking the session ends every token of it at
    /// once. Ends 60 days after sign-in at the latest, earlier on logout, account deletion or refresh-token reuse.
    /// </summary>
    public class AuthSession
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime LastUsedAt { get; set; }
        /// <summary>Absolute end, however actively the session is used.</summary>
        public DateTime ExpiresAt { get; set; }
        public DateTime? RevokedAt { get; set; }
        /// <summary>logout, reuse, account_deleted.</summary>
        public string? RevokeReason { get; set; }
    }
}
