namespace Coffer.Domain.Entities
{
    /// <summary>
    /// One thing a user did ("rated Heineken 5★", "shipped the deal"), in their private activity log. Targets are ids
    /// only — no foreign keys, so the entry outlives a deleted target and shows "No longer available" — and names are
    /// looked up when the log is read, so another person's name is never kept here.
    /// </summary>
    public class ActivityEvent
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        /// <summary>What happened, e.g. "reaction.rerated" (see Coffer.BusinessLogic.Activity.ActivityKinds).</summary>
        public string Kind { get; set; } = "";
        public string Category { get; set; } = "";
        public DateTime OccurredAt { get; set; }

        public Guid? ItemId { get; set; }
        public Guid? CollectionId { get; set; }
        public Guid? CommentId { get; set; }
        public Guid? ListingId { get; set; }
        public Guid? ConversationId { get; set; }
        public Guid? DealId { get; set; }
        public Guid? ReviewId { get; set; }
        public Guid? ReportId { get; set; }
        /// <summary>The other person involved (item owner, trading partner), for "with Anna".</summary>
        public Guid? OtherUserId { get; set; }

        /// <summary>JSON facts the sentence needs that may change later, e.g. {"from":3,"to":5}. Never names or other people's text.</summary>
        public string Details { get; set; } = "{}";
        /// <summary>Filled from existing data when the log was introduced (not recorded live).</summary>
        public bool Backfilled { get; set; }
    }
}
