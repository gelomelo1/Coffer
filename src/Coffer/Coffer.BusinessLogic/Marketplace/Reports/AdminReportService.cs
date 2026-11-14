using System.Text.Json;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Marketplace.Messaging;
using Coffer.DataAccess;
using Coffer.Domain.Constants;
using Coffer.Domain.Marketplace;
using Microsoft.EntityFrameworkCore;

namespace Coffer.BusinessLogic.Marketplace.Reports
{
    public interface IAdminReportService
    {
        Task<List<AdminReportSummaryDto>> ListAsync(Guid adminId, ReportStatus? status, ReportTargetType? targetType);
        Task<AdminReportDto> GetAsync(Guid adminId, Guid reportId);
        Task<AdminReportDto> ResolveAsync(Guid adminId, Guid reportId, ResolveReportInput input);
    }

    /// <summary>
    /// Admin side of the report queue (used by Coffer.Manager). Decisions are only "breaks rule X → remove" or
    /// "no violation"; deals are never arbitrated. Removals produce a statement of reasons for the content owner
    /// that does not reveal the reporter.
    /// </summary>
    public class AdminReportService : IAdminReportService
    {
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
        private readonly CofferDbContext _db;
        private readonly IClock _clock;
        private readonly IConversationService _conversations;

        public AdminReportService(CofferDbContext db, IClock clock, IConversationService conversations)
        {
            _db = db;
            _clock = clock;
            _conversations = conversations;
        }

        public async Task<List<AdminReportSummaryDto>> ListAsync(Guid adminId, ReportStatus? status, ReportTargetType? targetType)
        {
            await RequireAdminAsync(adminId);
            var q = _db.Reports.AsNoTracking();
            if (status.HasValue) q = q.Where(r => r.Status == status.Value);
            if (targetType.HasValue) q = q.Where(r => r.TargetType == targetType.Value);
            var reports = await q.OrderBy(r => r.Status).ThenBy(r => r.CreatedAt).ToListAsync();
            var users = await UsersAsync(reports.SelectMany(r => new[] { r.ReporterId, r.TargetOwnerId }));
            return reports.Select(r => new AdminReportSummaryDto(r.Id, r.TargetType, r.Rule, r.Reason, r.TargetSummary, r.Status, r.Decision,
                User(users, r.ReporterId), User(users, r.TargetOwnerId), r.CreatedAt)).ToList();
        }

        public async Task<AdminReportDto> GetAsync(Guid adminId, Guid reportId)
        {
            await RequireAdminAsync(adminId);
            var r = await _db.Reports.AsNoTracking().FirstOrDefaultAsync(x => x.Id == reportId) ?? throw MarketplaceException.NotFound("Report not found.");
            var users = await UsersAsync(new[] { r.ReporterId, r.TargetOwnerId });
            var priorRemovals = await _db.ModerationActions.CountAsync(a => a.UserId == r.TargetOwnerId);
            var openOnTarget = await _db.Reports.CountAsync(x => x.TargetType == r.TargetType && x.TargetId == r.TargetId && x.Status == ReportStatus.Open);
            using var snapshot = JsonDocument.Parse(r.Snapshot);
            using var current = JsonDocument.Parse(JsonSerializer.Serialize(await CurrentStateAsync(r), Json));
            return new AdminReportDto(r.Id, r.TargetType, r.TargetId, r.ListingId, r.ConversationId, r.Rule, r.Reason, r.TargetSummary,
                r.Status, r.Decision, r.Statement, User(users, r.ReporterId), User(users, r.TargetOwnerId), priorRemovals, openOnTarget,
                snapshot.RootElement.Clone(), current.RootElement.Clone(), r.CreatedAt, r.ResolvedAt);
        }

        public async Task<AdminReportDto> ResolveAsync(Guid adminId, Guid reportId, ResolveReportInput input)
        {
            await RequireAdminAsync(adminId);
            var report = await _db.Reports.FirstOrDefaultAsync(r => r.Id == reportId) ?? throw MarketplaceException.NotFound("Report not found.");
            if (report.Status == ReportStatus.Resolved) throw MarketplaceException.Conflict("This report is already resolved.");
            if (!Enum.IsDefined(input.Decision)) throw MarketplaceException.Validation("Unknown decision.");

            var now = _clock.UtcNow;
            string? statement;
            if (input.Decision == ReportDecision.Removed)
            {
                var rule = input.Rule ?? report.Rule;
                if (!ReportRules.Applies(rule, report.TargetType)) throw MarketplaceException.Validation("This rule doesn't apply to this kind of content.");
                statement = Text.Required(input.Statement, 10, 1000, "Statement of reasons");
                report.Rule = rule;
                var excerpt = await RemoveTargetAsync(report);
                _db.ModerationActions.Add(new ModerationAction
                {
                    UserId = report.TargetOwnerId,
                    TargetType = report.TargetType,
                    TargetId = report.TargetId,
                    ListingId = report.ListingId,
                    ConversationId = report.ConversationId,
                    Rule = rule,
                    Statement = statement,
                    ContentExcerpt = excerpt,
                    CreatedAt = now,
                });
            }
            else
            {
                statement = Text.Optional(input.Statement, 1000, "Note");
                if (report.TargetType == ReportTargetType.Review)
                {
                    var review = await _db.Reviews.FirstOrDefaultAsync(x => x.Id == report.TargetId);
                    if (review != null) review.IsFrozen = false;
                }
            }

            // One decision covers every open report on the same content (other reporters get the same outcome).
            var sameTarget = await _db.Reports.Where(r => r.TargetType == report.TargetType && r.TargetId == report.TargetId
                && r.Status == ReportStatus.Open && (input.Decision == ReportDecision.Removed || r.Id == report.Id)).ToListAsync();
            foreach (var r in sameTarget)
            {
                r.Status = ReportStatus.Resolved;
                r.Decision = input.Decision;
                r.Statement = statement;
                r.ResolvedBy = adminId;
                r.ResolvedAt = now;
            }

            await _db.SaveChangesAsync();
            return await GetAsync(adminId, reportId);
        }

        // ------------------------------------------------------------------ effects

        /// <summary>Applies the removal and returns the excerpt shown to the content owner.</summary>
        private async Task<string> RemoveTargetAsync(Report report)
        {
            switch (report.TargetType)
            {
                case ReportTargetType.Listing:
                {
                    var listing = await _db.Listings.FirstOrDefaultAsync(l => l.Id == report.TargetId) ?? throw MarketplaceException.NotFound("Listing not found.");
                    listing.Status = ListingStatus.Removed;
                    listing.UpdatedAt = _clock.UtcNow;
                    var openDeals = await _db.Deals.Where(d => d.ListingId == listing.Id
                        && (d.Status == DealStatus.Proposed || d.Status == DealStatus.AwaitingHandoff || d.Status == DealStatus.AwaitingShipment)).ToListAsync();
                    foreach (var deal in openDeals)
                    {
                        deal.Status = DealStatus.Cancelled;
                        deal.HandoffPin = null;
                        deal.CancelReason = "The listing was removed for breaking the marketplace rules.";
                        deal.UpdatedAt = _clock.UtcNow;
                        await _conversations.PostSystemAsync(deal.ConversationId, "🛡️ This listing was removed for breaking the marketplace rules. The deal is cancelled.");
                    }
                    return listing.Title;
                }
                case ReportTargetType.Message:
                {
                    var message = await _db.Messages.FirstOrDefaultAsync(m => m.Id == report.TargetId) ?? throw MarketplaceException.NotFound("Message not found.");
                    message.IsRemoved = true;
                    return ReportService.Excerpt(message.Body);
                }
                default:
                {
                    var review = await _db.Reviews.FirstOrDefaultAsync(r => r.Id == report.TargetId) ?? throw MarketplaceException.NotFound("Review not found.");
                    review.IsRemoved = true;
                    review.IsFrozen = false;
                    return ReportService.ReviewSummary(review);
                }
            }
        }

        private async Task<object> CurrentStateAsync(Report r) => r.TargetType switch
        {
            ReportTargetType.Listing => await _db.Listings.AsNoTracking()
                .Where(l => l.Id == r.TargetId).Select(l => new { exists = true, status = EnumText.ToSnake(l.Status), l.Title, l.UpdatedAt }).FirstOrDefaultAsync()
                ?? (object)new { exists = false },
            ReportTargetType.Message => await _db.Messages.AsNoTracking()
                .Where(m => m.Id == r.TargetId).Select(m => new { exists = true, m.IsRemoved, m.Body }).FirstOrDefaultAsync()
                ?? (object)new { exists = false },
            _ => await _db.Reviews.AsNoTracking()
                .Where(v => v.Id == r.TargetId).Select(v => new { exists = true, v.Stars, v.Comment, v.IsFrozen, v.IsRemoved, v.Reply }).FirstOrDefaultAsync()
                ?? (object)new { exists = false },
        };

        private async Task RequireAdminAsync(Guid userId)
        {
            var role = await _db.Users.Where(u => u.Id == userId).Select(u => (UserRole?)u.Role).FirstOrDefaultAsync();
            if (role != UserRole.Admin) throw MarketplaceException.Forbidden("Admins only.");
        }

        private async Task<Dictionary<Guid, UserSummaryDto>> UsersAsync(IEnumerable<Guid> ids)
        {
            var list = ids.Distinct().ToList();
            var users = await _db.Users.AsNoTracking().Where(u => list.Contains(u.Id)).ToListAsync();
            return users.ToDictionary(u => u.Id, UserSummaryDto.From);
        }

        private static UserSummaryDto User(Dictionary<Guid, UserSummaryDto> users, Guid id) =>
            users.TryGetValue(id, out var u) ? u : new UserSummaryDto(id, "deleted user", null);
    }
}
