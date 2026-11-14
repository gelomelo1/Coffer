using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Marketplace.Messaging;
using Coffer.DataAccess;
using Coffer.Domain.Marketplace;
using Microsoft.EntityFrameworkCore;

namespace Coffer.BusinessLogic.Marketplace.Reports
{
    public interface IReportService
    {
        Task<MyReportDto> CreateAsync(Guid userId, CreateReportInput input);
        Task<List<MyReportDto>> GetMineAsync(Guid userId);
        IReadOnlyList<ReportRuleDto> GetRules();
        Task<List<ModerationActionDto>> GetAgainstMeAsync(Guid userId);
        Task<int> CountUnseenAgainstMeAsync(Guid userId);
        Task MarkAgainstMeSeenAsync(Guid userId);
    }

    /// <summary>
    /// User side of notice &amp; action: anyone can flag a listing, a collection item or an item comment, a participant
    /// can flag a chat message, and the reviewed person can flag a review. Reports are judged only against the fixed content rules.
    /// </summary>
    public class ReportService : IReportService
    {
        public const int MinReason = 10;
        public const int MaxReason = 1000;

        private readonly CofferDbContext _db;
        private readonly IClock _clock;
        private readonly ReportSnapshotBuilder _snapshots;

        public ReportService(CofferDbContext db, IClock clock, ReportSnapshotBuilder snapshots)
        {
            _db = db;
            _clock = clock;
            _snapshots = snapshots;
        }

        public IReadOnlyList<ReportRuleDto> GetRules() => ReportRules.List;

        public async Task<MyReportDto> CreateAsync(Guid userId, CreateReportInput input)
        {
            if (!Enum.IsDefined(input.TargetType)) throw MarketplaceException.Validation("Unknown report target.");
            var reason = Text.Required(input.Reason, MinReason, MaxReason, "Reason");
            if (!ReportRules.Applies(input.Rule, input.TargetType))
                throw MarketplaceException.Validation("This rule doesn't apply to this kind of content.");

            var report = new Report
            {
                ReporterId = userId,
                TargetType = input.TargetType,
                TargetId = input.TargetId,
                Rule = input.Rule,
                Reason = reason,
                Status = ReportStatus.Open,
                CreatedAt = _clock.UtcNow,
            };

            switch (input.TargetType)
            {
                case ReportTargetType.Listing:
                    await FillListingAsync(report, userId);
                    break;
                case ReportTargetType.Message:
                    await FillMessageAsync(report, userId);
                    break;
                case ReportTargetType.Review:
                    await FillReviewAsync(report, userId);
                    break;
                case ReportTargetType.Item:
                    await FillItemAsync(report, userId);
                    break;
                case ReportTargetType.Comment:
                    await FillCommentAsync(report, userId);
                    break;
            }

            if (await _db.Reports.AnyAsync(r => r.ReporterId == userId && r.TargetType == report.TargetType
                    && r.TargetId == report.TargetId && r.Status == ReportStatus.Open))
                throw MarketplaceException.Conflict("You already reported this. It is waiting for review.");

            _db.Reports.Add(report);
            await _db.SaveChangesAsync();
            return ToMine(report);
        }

        public async Task<List<MyReportDto>> GetMineAsync(Guid userId)
        {
            var reports = await _db.Reports.AsNoTracking().Where(r => r.ReporterId == userId)
                .OrderByDescending(r => r.CreatedAt).ToListAsync();
            return reports.Select(ToMine).ToList();
        }

        public async Task<List<ModerationActionDto>> GetAgainstMeAsync(Guid userId)
        {
            var actions = await _db.ModerationActions.AsNoTracking().Where(a => a.UserId == userId)
                .OrderByDescending(a => a.CreatedAt).ToListAsync();
            return actions.Select(a => new ModerationActionDto(a.Id, a.TargetType, a.TargetId, a.ListingId, a.ConversationId, a.ItemId, a.Rule,
                ReportRules.Get(a.Rule).Label, a.Statement, a.ContentExcerpt, a.CreatedAt, a.SeenAt != null)).ToList();
        }

        public Task<int> CountUnseenAgainstMeAsync(Guid userId) =>
            _db.ModerationActions.CountAsync(a => a.UserId == userId && a.SeenAt == null);

        public async Task MarkAgainstMeSeenAsync(Guid userId)
        {
            var unseen = await _db.ModerationActions.Where(a => a.UserId == userId && a.SeenAt == null).ToListAsync();
            foreach (var a in unseen) a.SeenAt = _clock.UtcNow;
            await _db.SaveChangesAsync();
        }

        // ------------------------------------------------------------------ targets

        private async Task FillListingAsync(Report report, Guid userId)
        {
            var listing = await _db.Listings.AsNoTracking().FirstOrDefaultAsync(l => l.Id == report.TargetId)
                ?? throw MarketplaceException.NotFound("Listing not found.");
            if (listing.OwnerId == userId) throw MarketplaceException.Forbidden("You can't report your own listing.");
            if (listing.Status == ListingStatus.Removed) throw MarketplaceException.Conflict("This listing was already removed.");

            report.TargetOwnerId = listing.OwnerId;
            report.ListingId = listing.Id;
            report.TargetSummary = listing.Title;
            report.Snapshot = await _snapshots.ListingAsync(listing.Id);
        }

        private async Task FillMessageAsync(Report report, Guid userId)
        {
            var message = await _db.Messages.AsNoTracking().FirstOrDefaultAsync(m => m.Id == report.TargetId);
            var conversation = message == null ? null : await _db.Conversations.AsNoTracking().Include(c => c.Participants)
                .FirstOrDefaultAsync(c => c.Id == message.ConversationId);
            // Non-participants can't see the message, so for them it doesn't exist.
            if (message == null || conversation == null || conversation.Participants.All(p => p.UserId != userId))
                throw MarketplaceException.NotFound("Message not found.");
            if (message.SenderId == null) throw MarketplaceException.Validation("System messages can't be reported.");
            if (message.SenderId == userId) throw MarketplaceException.Forbidden("You can't report your own message.");
            if (message.IsRemoved) throw MarketplaceException.Conflict("This message was already removed.");

            report.TargetOwnerId = message.SenderId.Value;
            report.ConversationId = conversation.Id;
            report.ListingId = conversation.SubjectType == ListingConversationPolicy.Type ? conversation.SubjectId : null;
            report.TargetSummary = Excerpt(message.Body.Length > 0 ? message.Body : $"[{EnumText.ToSnake(message.Kind).Replace('_', ' ')}]");
            report.Snapshot = await _snapshots.MessageAsync(message, conversation);
        }

        private async Task FillReviewAsync(Report report, Guid userId)
        {
            var review = await _db.Reviews.FirstOrDefaultAsync(r => r.Id == report.TargetId && !r.IsRemoved)
                ?? throw MarketplaceException.NotFound("Review not found.");
            if (review.RevieweeId != userId) throw MarketplaceException.Forbidden("Only the reviewed person can report a review.");
            if (review.PublishedAt == null) throw MarketplaceException.Conflict("This review is not published yet.");
            if (review.ReviewerId == null) throw MarketplaceException.Conflict("The author of this review no longer exists.");
            var deal = await _db.Deals.AsNoTracking().FirstAsync(d => d.Id == review.DealId);

            // While a report is open the review stops counting toward the average.
            review.IsFrozen = true;
            report.TargetOwnerId = review.ReviewerId.Value;
            report.ListingId = deal.ListingId;
            report.ConversationId = deal.ConversationId;
            report.TargetSummary = ReviewSummary(review);
            report.Snapshot = await _snapshots.ReviewAsync(review, deal);
        }

        private async Task FillItemAsync(Report report, Guid userId)
        {
            var item = await _db.Items.AsNoTracking().Where(i => i.Id == report.TargetId)
                .Select(i => new { i.Id, i.Description, OwnerId = i.Collection.UserId, CollectionName = i.Collection.Name })
                .FirstOrDefaultAsync() ?? throw MarketplaceException.NotFound("Item not found.");
            if (item.OwnerId == userId) throw MarketplaceException.Forbidden("You can't report your own item.");

            report.TargetOwnerId = item.OwnerId;
            report.ItemId = item.Id;
            report.TargetSummary = Excerpt(string.IsNullOrWhiteSpace(item.Description) ? $"Item in “{item.CollectionName}”" : item.Description);
            report.Snapshot = await _snapshots.ItemAsync(item.Id);
        }

        private async Task FillCommentAsync(Report report, Guid userId)
        {
            var comment = await _db.ItemComments.AsNoTracking().FirstOrDefaultAsync(c => c.Id == report.TargetId)
                ?? throw MarketplaceException.NotFound("Comment not found.");
            if (comment.DeletedAt != null) throw MarketplaceException.NotFound("Comment not found.");
            if (comment.AuthorId == userId) throw MarketplaceException.Forbidden("You can't report your own comment.");
            if (comment.IsRemoved) throw MarketplaceException.Conflict("This comment was already removed.");

            report.TargetOwnerId = comment.AuthorId;
            report.ItemId = comment.ItemId;
            report.TargetSummary = Excerpt(comment.Body);
            report.Snapshot = await _snapshots.CommentAsync(comment);
        }

        public static string ReviewSummary(Review r) =>
            Excerpt($"{r.Stars}★ review" + (string.IsNullOrWhiteSpace(r.Comment) ? "" : $": {r.Comment}"));

        public static string Excerpt(string text) => text.Length > 200 ? text[..200] + "…" : text;

        private static MyReportDto ToMine(Report r) => new(r.Id, r.TargetType, r.TargetId, r.ListingId, r.ConversationId, r.ItemId, r.TargetSummary,
            r.Rule, r.Reason, r.Status, r.Decision, r.Statement, r.CreatedAt, r.ResolvedAt);
    }
}
