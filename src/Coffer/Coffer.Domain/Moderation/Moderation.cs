namespace Coffer.Domain.Moderation
{
    /// <summary>
    /// A GitHub account that signed in to Coffer.Manager. Gives admin actions an auditable identity; it does not
    /// grant anything by itself — access is decided per request from COFFER_MANAGER_ADMIN_GITHUB_PROVIDER_IDS.
    /// </summary>
    public class ManagerAdmin
    {
        public Guid Id { get; set; }
        /// <summary>GitHub's immutable numeric user id (as text).</summary>
        public string GithubId { get; set; } = "";
        /// <summary>GitHub login at the last sign-in (display only, never used for authorization).</summary>
        public string Login { get; set; } = "";
        public DateTime CreatedAt { get; set; }
        public DateTime LastLoginAt { get; set; }
    }

    /// <summary>A temporary account suspension. Active while not revoked and the current time is before <see cref="EndsAt"/>.</summary>
    public class UserSuspension
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public string Reason { get; set; } = "";
        public DateTime StartsAt { get; set; }
        public DateTime EndsAt { get; set; }
        public Guid CreatedByAdminId { get; set; }
        /// <summary>The report that led to the suspension, when it came from report resolution.</summary>
        public Guid? SourceReportId { get; set; }
        public DateTime? RevokedAt { get; set; }
        public Guid? RevokedByAdminId { get; set; }
        public string? RevokeReason { get; set; }
        public DateTime CreatedAt { get; set; }

        public bool IsActiveAt(DateTime now) => RevokedAt == null && StartsAt <= now && now < EndsAt;
    }

    /// <summary>Append-only log of everything an administrator did in Coffer.Manager.</summary>
    public class AdminAuditEntry
    {
        public Guid Id { get; set; }
        public Guid AdminId { get; set; }
        /// <summary>e.g. "login", "reports.resolve", "suspension.create", "suspension.revoke".</summary>
        public string Action { get; set; } = "";
        public string? TargetType { get; set; }
        public Guid? TargetId { get; set; }
        /// <summary>JSON details of the action.</summary>
        public string Details { get; set; } = "{}";
        public DateTime CreatedAt { get; set; }
    }
}
