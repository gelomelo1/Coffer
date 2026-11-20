using System.Text.Json;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.DataAccess;
using Coffer.Domain.Entities;

namespace Coffer.BusinessLogic.Activity
{
    /// <summary>What an activity entry is about: ids only, resolved to names/images when the log is read.</summary>
    public sealed record ActivityTargets(Guid? ItemId = null, Guid? CollectionId = null, Guid? CommentId = null, Guid? ListingId = null,
        Guid? ConversationId = null, Guid? DealId = null, Guid? ReviewId = null, Guid? ReportId = null, Guid? OtherUserId = null);

    /// <summary>Every kind of activity and its category (the sub-pages of My activity).</summary>
    public static class ActivityKinds
    {
        public static readonly string[] Categories = { "likes", "comments", "collection", "follows", "marketplace", "trades", "reports" };

        public static readonly IReadOnlyDictionary<string, string> Category = new Dictionary<string, string>
        {
            ["reaction.liked"] = "likes", ["reaction.unliked"] = "likes", ["reaction.rated"] = "likes", ["reaction.rerated"] = "likes", ["reaction.unrated"] = "likes",
            ["comment.posted"] = "comments", ["comment.replied"] = "comments", ["comment.edited"] = "comments", ["comment.deleted"] = "comments",
            ["collection.created"] = "collection", ["collection.edited"] = "collection", ["collection.deleted"] = "collection",
            ["item.added"] = "collection", ["item.addedToExisting"] = "collection", ["item.edited"] = "collection", ["item.deleted"] = "collection",
            ["follow.followed"] = "follows", ["follow.unfollowed"] = "follows",
            ["listing.posted"] = "marketplace", ["listing.edited"] = "marketplace", ["listing.archived"] = "marketplace", ["listing.reactivated"] = "marketplace",
            ["chat.started"] = "marketplace", ["offer.sent"] = "marketplace", ["meetup.proposed"] = "marketplace",
            ["proposal.accepted"] = "marketplace", ["proposal.declined"] = "marketplace", ["proposal.withdrawn"] = "marketplace",
            ["deal.proposed"] = "trades", ["deal.accepted"] = "trades", ["deal.declined"] = "trades", ["deal.cancelled"] = "trades",
            ["deal.handoffConfirmed"] = "trades", ["deal.shipped"] = "trades", ["deal.receiptConfirmed"] = "trades", ["deal.disputed"] = "trades",
            ["review.written"] = "trades", ["review.replied"] = "trades",
            ["report.filed"] = "reports",
        };
    }

    public interface IActivityLog
    {
        /// <summary>
        /// Adds an entry to the user's log. It is saved by the action's own SaveChanges (never on its own), so a failed
        /// action leaves no entry and every entry matches a real change.
        /// </summary>
        void Record(Guid userId, string kind, ActivityTargets targets, object? details = null);
    }

    public sealed class ActivityLog : IActivityLog
    {
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
        private readonly CofferDbContext _db;
        private readonly IClock _clock;

        public ActivityLog(CofferDbContext db, IClock clock)
        {
            _db = db;
            _clock = clock;
        }

        public void Record(Guid userId, string kind, ActivityTargets targets, object? details = null)
        {
            if (!ActivityKinds.Category.TryGetValue(kind, out var category))
                throw new ArgumentException($"Unknown activity kind '{kind}'.", nameof(kind));
            _db.ActivityEvents.Add(new ActivityEvent
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Kind = kind,
                Category = category,
                OccurredAt = _clock.UtcNow,
                ItemId = targets.ItemId,
                CollectionId = targets.CollectionId,
                CommentId = targets.CommentId,
                ListingId = targets.ListingId,
                ConversationId = targets.ConversationId,
                DealId = targets.DealId,
                ReviewId = targets.ReviewId,
                ReportId = targets.ReportId,
                OtherUserId = targets.OtherUserId,
                Details = details == null ? "{}" : JsonSerializer.Serialize(details, Json),
            });
        }
    }
}
