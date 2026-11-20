using System.Text.Json;
using Coffer.BusinessLogic.Marketplace.Deals;
using Coffer.DataAccess;
using Coffer.Domain.Entities;
using Coffer.Domain.Marketplace;
using Microsoft.EntityFrameworkCore;

namespace Coffer.BusinessLogic.Activity
{
    public interface IActivityBackfill
    {
        /// <summary>Fills the log from rows that carry a date, once. Returns the number of entries added.</summary>
        Task<int> RunAsync();
    }

    /// <summary>
    /// The one-time fill of the past. Only facts a row's own date proves become entries (likes and ratings have no date,
    /// so they are left out). Runs at startup; does nothing once a filled entry exists. When live recording began
    /// before the fill ever ran, only rows older than the first live entry are filled (newer ones were logged live).
    /// </summary>
    public sealed class ActivityBackfill : IActivityBackfill
    {
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
        private readonly CofferDbContext _db;

        public ActivityBackfill(CofferDbContext db)
        {
            _db = db;
        }

        public async Task<int> RunAsync()
        {
            if (await _db.ActivityEvents.AnyAsync(e => e.Backfilled)) return 0;
            var firstLive = await _db.ActivityEvents.OrderBy(e => e.OccurredAt).Select(e => (DateTime?)e.OccurredAt).FirstOrDefaultAsync();
            var deleted = (await _db.Users.Where(u => u.DeletedAt != null).Select(u => u.Id).ToListAsync()).ToHashSet();
            var events = new List<ActivityEvent>();

            void Add(Guid userId, string kind, DateTime? at, ActivityTargets targets, object? details = null)
            {
                if (at == null || deleted.Contains(userId) || (firstLive.HasValue && at.Value >= firstLive.Value)) return;
                events.Add(new ActivityEvent
                {
                    Id = Guid.NewGuid(), UserId = userId, Kind = kind, Category = ActivityKinds.Category[kind],
                    OccurredAt = DateTime.SpecifyKind(at.Value, DateTimeKind.Utc),
                    ItemId = targets.ItemId, CollectionId = targets.CollectionId, CommentId = targets.CommentId, ListingId = targets.ListingId,
                    ConversationId = targets.ConversationId, DealId = targets.DealId, ReviewId = targets.ReviewId, ReportId = targets.ReportId,
                    OtherUserId = targets.OtherUserId,
                    Details = details == null ? "{}" : JsonSerializer.Serialize(details, Json),
                    Backfilled = true,
                });
            }

            foreach (var c in await _db.Collections.AsNoTracking().Select(c => new { c.Id, c.UserId, c.CreatedAt }).ToListAsync())
                Add(c.UserId, "collection.created", c.CreatedAt, new ActivityTargets(CollectionId: c.Id));

            // Items, live and deleted. No quantity: today's count may differ from what was first added.
            foreach (var i in await _db.Items.AsNoTracking().Join(_db.Collections, i => i.CollectionId, c => c.Id,
                         (i, c) => new { i.Id, i.CollectionId, OwnerId = c.UserId, i.AcquiredAt }).ToListAsync())
                Add(i.OwnerId, "item.added", i.AcquiredAt, new ActivityTargets(ItemId: i.Id, CollectionId: i.CollectionId));

            foreach (var f in await _db.Follows.AsNoTracking().Select(f => new { f.UserId, f.CollectionId, f.FollowedAt }).ToListAsync())
                Add(f.UserId, "follow.followed", f.FollowedAt, new ActivityTargets(CollectionId: f.CollectionId));

            foreach (var c in await _db.ItemComments.AsNoTracking().Select(c => new { c.Id, c.ItemId, c.AuthorId, c.ParentId, c.CreatedAt }).ToListAsync())
                Add(c.AuthorId, c.ParentId == null ? "comment.posted" : "comment.replied", c.CreatedAt, new ActivityTargets(ItemId: c.ItemId, CommentId: c.Id));

            foreach (var l in await _db.Listings.AsNoTracking().Select(l => new { l.Id, l.OwnerId, l.CreatedAt }).ToListAsync())
                Add(l.OwnerId, "listing.posted", l.CreatedAt, new ActivityTargets(ListingId: l.Id));

            var deals = await _db.Deals.AsNoTracking().Select(d => new
            {
                d.Id, d.ListingId, d.ConversationId, d.SellerId, d.BuyerId, d.CreatedAt, d.UpdatedAt, d.ShippedAt, d.ReceivedAt, d.DisputedAt,
                d.CancelledBy, d.CancelReason, d.Status,
            }).ToListAsync();
            foreach (var d in deals)
            {
                ActivityTargets For(Guid actor) => new(DealId: d.Id, ConversationId: d.ConversationId, ListingId: d.ListingId,
                    OtherUserId: actor == d.SellerId ? d.BuyerId : d.SellerId);
                Add(d.SellerId, "deal.proposed", d.CreatedAt, For(d.SellerId));
                Add(d.SellerId, "deal.shipped", d.ShippedAt, For(d.SellerId));
                Add(d.BuyerId, "deal.receiptConfirmed", d.ReceivedAt, For(d.BuyerId));
                Add(d.BuyerId, "deal.disputed", d.DisputedAt, For(d.BuyerId));
                if (d.Status == DealStatus.Cancelled && d.CancelledBy is { } by)
                    Add(by, d.CancelReason == DealService.DeclinedReason ? "deal.declined" : "deal.cancelled", d.UpdatedAt, For(by));
            }

            foreach (var r in await _db.Reviews.AsNoTracking().Select(r => new { r.Id, r.DealId, r.ReviewerId, r.RevieweeId, r.Stars, r.CreatedAt, r.RepliedAt }).ToListAsync())
            {
                if (r.ReviewerId is not { } reviewer) continue; // reviewer's account deleted
                var reviewee = r.RevieweeId;
                Add(reviewer, "review.written", r.CreatedAt, new ActivityTargets(ReviewId: r.Id, DealId: r.DealId, OtherUserId: reviewee), new { stars = r.Stars });
                Add(reviewee, "review.replied", r.RepliedAt, new ActivityTargets(ReviewId: r.Id, DealId: r.DealId, OtherUserId: reviewer));
            }

            foreach (var r in await _db.Reports.AsNoTracking().ToListAsync())
                Add(r.ReporterId, "report.filed", r.CreatedAt, new ActivityTargets(
                    ReportId: r.Id, ItemId: r.ItemId, ListingId: r.ListingId, ConversationId: r.ConversationId,
                    CommentId: r.TargetType == ReportTargetType.Comment ? r.TargetId : null,
                    ReviewId: r.TargetType == ReportTargetType.Review ? r.TargetId : null,
                    OtherUserId: r.TargetOwnerId));

            _db.ActivityEvents.AddRange(events);
            await _db.SaveChangesAsync();
            return events.Count;
        }
    }
}
