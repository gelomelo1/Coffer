using System.Text.Json;
using Coffer.BusinessLogic.Community;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Marketplace.Messaging;
using Coffer.BusinessLogic.Moderation;
using Coffer.DataAccess;
using Coffer.Domain.Marketplace;
using Microsoft.EntityFrameworkCore;

namespace Coffer.BusinessLogic.Marketplace.Reports
{
    public interface IAdminReportService
    {
        Task<PagedResult<AdminReportSummaryDto>> ListAsync(ReportStatus? status, ReportTargetType? targetType, int page = 1, int pageSize = 50);
        Task<AdminReportDto> GetAsync(Guid reportId);
        Task<PagedResult<ReportedContentDto>> ListContentAsync(ReportStatus? status, ReportTargetType? targetType, int page = 1, int pageSize = 50);
        Task<ReportedContentDetailDto> GetContentAsync(ReportTargetType targetType, Guid targetId);

        /// <summary>Single report (kept for the existing workflow); same rules as <see cref="ResolveManyAsync"/>.</summary>
        Task<AdminReportDto> ResolveAsync(Guid adminId, Guid reportId, ResolveReportInput input);
        Task<ResolveReportsResultDto> ResolveManyAsync(Guid adminId, ResolveReportsInput input);
        Task<ResolveReportsResultDto> ResolveTargetAsync(Guid adminId, ReportTargetType targetType, Guid targetId, ResolveTargetInput input);
    }

    /// <summary>
    /// Admin side of the report queue (Coffer.Manager; authorization is the ManagerAdmin policy). Decisions only
    /// judge content against the rules: remove it, keep it and suspend its author, or no violation — deals are never
    /// arbitrated. Removals and suspensions produce a statement of reasons for the author that never names the reporter.
    /// </summary>
    public class AdminReportService : IAdminReportService
    {
        public const int MaxBulk = 500;
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
        private readonly CofferDbContext _db;
        private readonly IClock _clock;
        private readonly IConversationService _conversations;
        private readonly ISuspensionService _suspensions;
        private readonly IItemRemovalService _items;

        public AdminReportService(CofferDbContext db, IClock clock, IConversationService conversations, ISuspensionService suspensions, IItemRemovalService items)
        {
            _db = db;
            _clock = clock;
            _conversations = conversations;
            _suspensions = suspensions;
            _items = items;
        }

        // ------------------------------------------------------------------ reading

        public async Task<PagedResult<AdminReportSummaryDto>> ListAsync(ReportStatus? status, ReportTargetType? targetType, int page = 1, int pageSize = 50)
        {
            (page, pageSize) = SuspensionService.Paging(page, pageSize);
            var q = Filter(status, targetType);
            var total = await q.CountAsync();
            var reports = await q.OrderBy(r => r.Status).ThenByDescending(r => r.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
            var users = await UsersAsync(reports.SelectMany(r => new[] { r.ReporterId, r.TargetOwnerId }));
            return new PagedResult<AdminReportSummaryDto>(reports.Select(r => Summary(r, users)).ToList(), page, pageSize, total);
        }

        public async Task<AdminReportDto> GetAsync(Guid reportId)
        {
            var r = await _db.Reports.AsNoTracking().FirstOrDefaultAsync(x => x.Id == reportId) ?? throw MarketplaceException.NotFound("reportNotFound", "Report not found.");
            var users = await UsersAsync(new[] { r.ReporterId, r.TargetOwnerId });
            var priorRemovals = await _db.ModerationActions.CountAsync(a => a.UserId == r.TargetOwnerId);
            var openOnTarget = await _db.Reports.CountAsync(x => x.TargetType == r.TargetType && x.TargetId == r.TargetId && x.Status == ReportStatus.Open);
            var thumbnails = await ThumbnailsAsync(new[] { r });
            using var snapshot = JsonDocument.Parse(r.Snapshot);
            using var current = JsonDocument.Parse(JsonSerializer.Serialize(await CurrentStateAsync(r.TargetType, r.TargetId), Json));
            return new AdminReportDto(r.Id, r.TargetType, r.TargetId, r.ListingId, r.ConversationId, r.ItemId, r.Rule, r.Reason, r.TargetSummary,
                r.Status, r.Decision, r.Statement, r.SuspensionId, thumbnails.GetValueOrDefault((r.TargetType, r.TargetId)),
                User(users, r.ReporterId), User(users, r.TargetOwnerId), priorRemovals, openOnTarget,
                await _suspensions.GetActiveAsync(r.TargetOwnerId),
                snapshot.RootElement.Clone(), current.RootElement.Clone(), r.CreatedAt, r.ResolvedAt);
        }

        public async Task<PagedResult<ReportedContentDto>> ListContentAsync(ReportStatus? status, ReportTargetType? targetType, int page = 1, int pageSize = 50)
        {
            (page, pageSize) = SuspensionService.Paging(page, pageSize);
            var q = _db.Reports.AsNoTracking();
            if (targetType.HasValue) q = q.Where(r => r.TargetType == targetType.Value);

            var groups = q.GroupBy(r => new { r.TargetType, r.TargetId }).Select(g => new
            {
                g.Key.TargetType,
                g.Key.TargetId,
                Open = g.Count(r => r.Status == ReportStatus.Open),
                Latest = g.Max(r => r.CreatedAt),
            });
            // "open" = content with at least one open report; "resolved" = content whose reports are all resolved.
            if (status == ReportStatus.Open) groups = groups.Where(g => g.Open > 0);
            if (status == ReportStatus.Resolved) groups = groups.Where(g => g.Open == 0);

            var total = await groups.CountAsync();
            var pageKeys = await groups.OrderByDescending(g => g.Open > 0).ThenByDescending(g => g.Open).ThenByDescending(g => g.Latest)
                .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

            var ids = pageKeys.Select(k => k.TargetId).Distinct().ToList();
            var reports = await _db.Reports.AsNoTracking().Where(r => ids.Contains(r.TargetId)).ToListAsync();
            var users = await UsersAsync(reports.SelectMany(r => new[] { r.ReporterId, r.TargetOwnerId }));
            var thumbnails = await ThumbnailsAsync(reports);
            var items = pageKeys.Select(k => Group(reports.Where(r => r.TargetType == k.TargetType && r.TargetId == k.TargetId).ToList(), users, thumbnails)).ToList();
            return new PagedResult<ReportedContentDto>(items, page, pageSize, total);
        }

        public async Task<ReportedContentDetailDto> GetContentAsync(ReportTargetType targetType, Guid targetId)
        {
            var reports = await _db.Reports.AsNoTracking().Where(r => r.TargetType == targetType && r.TargetId == targetId)
                .OrderByDescending(r => r.CreatedAt).ToListAsync();
            if (reports.Count == 0) throw MarketplaceException.NotFound("noReportsOnThisContent", "No reports on this content.");
            var users = await UsersAsync(reports.SelectMany(r => new[] { r.ReporterId, r.TargetOwnerId }));
            var thumbnails = await ThumbnailsAsync(reports);
            var ownerId = reports[0].TargetOwnerId;
            using var snapshot = JsonDocument.Parse(reports[0].Snapshot);
            using var current = JsonDocument.Parse(JsonSerializer.Serialize(await CurrentStateAsync(targetType, targetId), Json));
            return new ReportedContentDetailDto(
                Group(reports, users, thumbnails),
                reports.OrderBy(r => r.Status).ThenByDescending(r => r.CreatedAt).Select(r => Summary(r, users)).ToList(),
                await _db.ModerationActions.CountAsync(a => a.UserId == ownerId),
                await _suspensions.GetActiveAsync(ownerId),
                snapshot.RootElement.Clone(),
                current.RootElement.Clone());
        }

        // ------------------------------------------------------------------ resolving

        public async Task<AdminReportDto> ResolveAsync(Guid adminId, Guid reportId, ResolveReportInput input)
        {
            await ResolveManyAsync(adminId, new ResolveReportsInput(new List<Guid> { reportId }, input.Decision, input.Rule, input.Statement, input.SuspensionHours));
            return await GetAsync(reportId);
        }

        public async Task<ResolveReportsResultDto> ResolveTargetAsync(Guid adminId, ReportTargetType targetType, Guid targetId, ResolveTargetInput input)
        {
            var open = await _db.Reports.Where(r => r.TargetType == targetType && r.TargetId == targetId && r.Status == ReportStatus.Open)
                .Select(r => r.Id).ToListAsync();
            if (open.Count == 0) throw MarketplaceException.Conflict("thisContentHasNoOpenReports", "This content has no open reports.");
            return await ResolveManyAsync(adminId, new ResolveReportsInput(open, input.Decision, input.Rule, input.Statement, input.SuspensionHours));
        }

        public async Task<ResolveReportsResultDto> ResolveManyAsync(Guid adminId, ResolveReportsInput input)
        {
            var ids = (input.ReportIds ?? new List<Guid>()).Distinct().ToList();
            if (ids.Count == 0) throw MarketplaceException.Validation("selectAtLeastOneReport", "Select at least one report.");
            if (ids.Count > MaxBulk) throw MarketplaceException.Validation("atMostReportsCanBeResolvedAt", $"At most {MaxBulk} reports can be resolved at once.", ErrorArgs.Of($"{MaxBulk}"));
            if (!Enum.IsDefined(input.Decision)) throw MarketplaceException.Validation("unknownDecision", "Unknown decision.");
            // The one explanation field: statement of reasons for the author, outcome for reporters, suspension reason.
            var statement = Text.Required(input.Statement, 10, 1000, "Explanation");

            int? hours = input.SuspensionHours;
            if (input.Decision == ReportDecision.Suspended && hours == null)
                throw MarketplaceException.Validation("chooseHowLongTheSuspensionLasts", "Choose how long the suspension lasts.");
            if (input.Decision == ReportDecision.NoViolation && hours != null)
                throw MarketplaceException.Validation("aUserCanTBeSuspendedWhen", "A user can't be suspended when the report shows no violation.");
            if (hours != null) SuspensionService.ValidateHours(hours.Value);

            var reports = await _db.Reports.Where(r => ids.Contains(r.Id)).ToListAsync();
            if (reports.Count != ids.Count) throw MarketplaceException.NotFound("someOfTheSelectedReportsDonT", "Some of the selected reports don't exist.");
            var closed = reports.Count(r => r.Status != ReportStatus.Open);
            if (closed > 0)
                throw closed == 1
                    ? MarketplaceException.Conflict("oneSelectedReportAlreadyResolved", "One of the selected reports is already resolved.")
                    : MarketplaceException.Conflict("selectedReportsAlreadyResolved", $"{closed} of the selected reports are already resolved.", ErrorArgs.Of($"{closed}"));

            var rulesByTarget = new Dictionary<(ReportTargetType, Guid), ReportRule>();
            foreach (var target in reports.GroupBy(r => (r.TargetType, r.TargetId)))
            {
                var rule = input.Rule ?? target.OrderByDescending(r => r.CreatedAt).First().Rule;
                if (input.Decision != ReportDecision.NoViolation && !ReportRules.Applies(rule, target.Key.TargetType))
                    throw MarketplaceException.Validation("theRuleDoesnTApplyToA", $"The rule doesn't apply to a {EnumText.ToSnake(target.Key.TargetType)}.", ErrorArgs.Of($"{EnumText.ToSnake(target.Key.TargetType)}"));
                rulesByTarget[target.Key] = rule;
            }

            var now = _clock.UtcNow;
            var notes = new List<string>();
            var removedItems = new List<(Guid Id, string? File)>();
            var suspensions = new Dictionary<Guid, AppliedSuspensionDto>();
            var removedTargets = 0;

            await using var tx = await _db.Database.BeginTransactionAsync();

            if (input.Decision == ReportDecision.Removed)
            {
                // Every open report on removed content is answered, not only the selected ones.
                var targetIds = reports.Select(r => r.TargetId).Distinct().ToList();
                var others = await _db.Reports.Where(r => targetIds.Contains(r.TargetId) && r.Status == ReportStatus.Open && !ids.Contains(r.Id)).ToListAsync();
                reports.AddRange(others.Where(o => rulesByTarget.ContainsKey((o.TargetType, o.TargetId))));
            }

            foreach (var target in reports.GroupBy(r => (r.TargetType, r.TargetId)))
            {
                var first = target.OrderByDescending(r => r.CreatedAt).First();
                var rule = rulesByTarget[target.Key];
                string? excerpt = null;

                if (input.Decision == ReportDecision.Removed)
                {
                    var removal = await RemoveTargetAsync(first);
                    if (removal.Excerpt == null)
                        notes.Add($"The {EnumText.ToSnake(first.TargetType)} “{first.TargetSummary}” no longer existed or was already removed.");
                    else
                        removedTargets++;
                    if (removal.ItemFile != null || first.TargetType == ReportTargetType.Item) removedItems.Add((first.TargetId, removal.ItemFile));
                    excerpt = removal.Excerpt ?? first.TargetSummary;
                }
                else
                {
                    await UnfreezeReviewAsync(target.ToList(), ids);
                }

                if (hours != null && !suspensions.ContainsKey(first.TargetOwnerId))
                {
                    var created = await _suspensions.AddAsync(adminId, first.TargetOwnerId, TimeSpan.FromHours(hours.Value), statement, first.Id);
                    var active = created ?? await _db.UserSuspensions.Where(s => s.UserId == first.TargetOwnerId && s.RevokedAt == null && s.StartsAt <= now && s.EndsAt > now)
                        .OrderByDescending(s => s.EndsAt).FirstAsync();
                    var name = await _db.Users.Where(u => u.Id == first.TargetOwnerId).Select(u => u.Name).FirstOrDefaultAsync() ?? "deleted user";
                    suspensions[first.TargetOwnerId] = new AppliedSuspensionDto(first.TargetOwnerId, name, active.Id, active.EndsAt, created != null);
                    if (created == null) notes.Add($"{name} already has a suspension until {active.EndsAt:u}; it was not extended.");
                }

                if (input.Decision != ReportDecision.NoViolation)
                {
                    var suspension = suspensions.GetValueOrDefault(first.TargetOwnerId);
                    _db.ModerationActions.Add(new ModerationAction
                    {
                        Id = Guid.NewGuid(),
                        UserId = first.TargetOwnerId,
                        TargetType = first.TargetType,
                        TargetId = first.TargetId,
                        ListingId = first.ListingId,
                        ConversationId = first.ConversationId,
                        ItemId = first.TargetType == ReportTargetType.Item && input.Decision == ReportDecision.Removed ? null : first.ItemId,
                        Rule = rule,
                        Statement = suspension == null ? statement : $"{statement}\n\nYour account is suspended until {suspension.EndsAt:yyyy-MM-dd HH:mm} UTC.",
                        ContentExcerpt = excerpt ?? first.TargetSummary,
                        CreatedAt = now,
                    });
                }

                foreach (var r in target)
                {
                    r.Status = ReportStatus.Resolved;
                    r.Decision = input.Decision;
                    if (input.Decision != ReportDecision.NoViolation) r.Rule = rule;
                    r.Statement = statement;
                    r.ResolvedBy = adminId;
                    r.ResolvedAt = now;
                    r.SuspensionId = suspensions.GetValueOrDefault(r.TargetOwnerId)?.SuspensionId;
                }
            }

            AdminAudit.Add(_db, adminId, "reports.resolve", null, null, new
            {
                decision = EnumText.ToSnake(input.Decision),
                reportIds = reports.Select(r => r.Id),
                rule = input.Rule == null ? null : EnumText.ToSnake(input.Rule.Value),
                statement,
                suspensionHours = hours,
            }, now);

            await _db.SaveChangesAsync();
            await tx.CommitAsync();

            foreach (var userId in suspensions.Keys) _suspensions.Forget(userId);
            foreach (var (itemId, file) in removedItems) await _items.DeleteFileAsync(itemId, file);

            return new ResolveReportsResultDto(reports.Count, reports.Select(r => r.Id).ToList(), removedTargets, suspensions.Values.ToList(), notes);
        }

        // ------------------------------------------------------------------ effects

        private sealed record Removal(string? Excerpt, string? ItemFile = null);

        /// <summary>Applies the removal; Excerpt is null when the content was already gone.</summary>
        private async Task<Removal> RemoveTargetAsync(Report report)
        {
            switch (report.TargetType)
            {
                case ReportTargetType.Listing:
                {
                    var listing = await _db.Listings.FirstOrDefaultAsync(l => l.Id == report.TargetId);
                    if (listing == null || listing.Status == ListingStatus.Removed) return new Removal(null);
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
                    return new Removal(listing.Title);
                }
                case ReportTargetType.Message:
                {
                    var message = await _db.Messages.FirstOrDefaultAsync(m => m.Id == report.TargetId);
                    if (message == null || message.IsRemoved) return new Removal(null);
                    message.IsRemoved = true;
                    return new Removal(ReportService.Excerpt(message.Body));
                }
                case ReportTargetType.Review:
                {
                    var review = await _db.Reviews.FirstOrDefaultAsync(r => r.Id == report.TargetId);
                    if (review == null || review.IsRemoved) return new Removal(null);
                    review.IsRemoved = true;
                    review.IsFrozen = false;
                    return new Removal(ReportService.ReviewSummary(review));
                }
                case ReportTargetType.Comment:
                {
                    var comment = await _db.ItemComments.FirstOrDefaultAsync(c => c.Id == report.TargetId);
                    if (comment == null || comment.IsRemoved || comment.DeletedAt != null) return new Removal(null);
                    comment.IsRemoved = true;
                    return new Removal(ReportService.Excerpt(comment.Body));
                }
                default:
                {
                    var file = await _items.RemoveAsync(report.TargetId);
                    return file == null ? new Removal(null) : new Removal(report.TargetSummary, file);
                }
            }
        }

        /// <summary>A review stops being frozen once no open report is left on it.</summary>
        private async Task UnfreezeReviewAsync(List<Report> resolving, List<Guid> selected)
        {
            var first = resolving[0];
            if (first.TargetType != ReportTargetType.Review) return;
            var resolvingIds = resolving.Select(r => r.Id).ToList();
            var stillOpen = await _db.Reports.AnyAsync(r => r.TargetType == ReportTargetType.Review && r.TargetId == first.TargetId
                && r.Status == ReportStatus.Open && !resolvingIds.Contains(r.Id));
            if (stillOpen) return;
            var review = await _db.Reviews.FirstOrDefaultAsync(x => x.Id == first.TargetId);
            if (review != null) review.IsFrozen = false;
        }

        // ------------------------------------------------------------------ helpers

        private IQueryable<Report> Filter(ReportStatus? status, ReportTargetType? targetType)
        {
            var q = _db.Reports.AsNoTracking();
            if (status.HasValue) q = q.Where(r => r.Status == status.Value);
            if (targetType.HasValue) q = q.Where(r => r.TargetType == targetType.Value);
            return q;
        }

        private static AdminReportSummaryDto Summary(Report r, Dictionary<Guid, UserSummaryDto> users) =>
            new(r.Id, r.TargetType, r.TargetId, r.Rule, r.Reason, r.TargetSummary, r.Status, r.Decision,
                User(users, r.ReporterId), User(users, r.TargetOwnerId), r.CreatedAt, r.ResolvedAt, r.Statement);

        private static ReportedContentDto Group(List<Report> reports, Dictionary<Guid, UserSummaryDto> users,
            Dictionary<(ReportTargetType, Guid), ThumbnailDto> thumbnails)
        {
            var latest = reports.OrderByDescending(r => r.CreatedAt).First();
            var statuses = reports.GroupBy(r => r.Status == ReportStatus.Open ? "open" : EnumText.ToSnake(r.Decision ?? ReportDecision.NoViolation))
                .ToDictionary(g => g.Key, g => g.Count());
            return new ReportedContentDto(
                latest.TargetType,
                latest.TargetId,
                latest.TargetSummary,
                thumbnails.GetValueOrDefault((latest.TargetType, latest.TargetId)),
                User(users, latest.TargetOwnerId),
                reports.Count,
                reports.Count(r => r.Status == ReportStatus.Open),
                reports.Select(r => r.Rule).Distinct().ToList(),
                reports.Select(r => r.ReporterId).Distinct().Select(id => User(users, id)).ToList(),
                statuses,
                latest.CreatedAt,
                latest.ListingId,
                latest.ItemId,
                latest.ConversationId);
        }

        /// <summary>
        /// A picture for each target, taken from the frozen snapshot (so removed content still shows what it was):
        /// listing image for listings/messages/reviews, the item image for items and comments.
        /// </summary>
        private static Task<Dictionary<(ReportTargetType, Guid), ThumbnailDto>> ThumbnailsAsync(IEnumerable<Report> reports)
        {
            var result = new Dictionary<(ReportTargetType, Guid), ThumbnailDto>();
            foreach (var r in reports.OrderByDescending(x => x.CreatedAt))
            {
                if (result.ContainsKey((r.TargetType, r.TargetId))) continue;
                var thumb = ThumbnailFromSnapshot(r);
                if (thumb != null) result[(r.TargetType, r.TargetId)] = thumb;
            }
            return Task.FromResult(result);
        }

        private static ThumbnailDto? ThumbnailFromSnapshot(Report r)
        {
            try
            {
                using var doc = JsonDocument.Parse(r.Snapshot);
                var root = doc.RootElement;
                if (root.TryGetProperty("item", out var item) && item.ValueKind == JsonValueKind.Object
                    && item.TryGetProperty("image", out var image) && image.ValueKind == JsonValueKind.String)
                    return new ThumbnailDto("item", image.GetString()!);
                if (root.TryGetProperty("listing", out var listing) && listing.ValueKind == JsonValueKind.Object
                    && listing.TryGetProperty("images", out var images) && images.ValueKind == JsonValueKind.Array && images.GetArrayLength() > 0)
                    return new ThumbnailDto("listing", images[0].GetString()!);
            }
            catch (JsonException) { }
            return null;
        }

        private async Task<object> CurrentStateAsync(ReportTargetType type, Guid targetId) => type switch
        {
            ReportTargetType.Listing => await _db.Listings.AsNoTracking()
                .Where(l => l.Id == targetId).Select(l => new { exists = true, status = EnumText.ToSnake(l.Status), l.Title, l.UpdatedAt }).FirstOrDefaultAsync()
                ?? (object)new { exists = false },
            ReportTargetType.Message => await _db.Messages.AsNoTracking()
                .Where(m => m.Id == targetId).Select(m => new { exists = true, m.IsRemoved, m.Body }).FirstOrDefaultAsync()
                ?? (object)new { exists = false },
            ReportTargetType.Review => await _db.Reviews.AsNoTracking()
                .Where(v => v.Id == targetId).Select(v => new { exists = true, v.Stars, v.Comment, v.IsFrozen, v.IsRemoved, v.Reply }).FirstOrDefaultAsync()
                ?? (object)new { exists = false },
            ReportTargetType.Comment => await _db.ItemComments.AsNoTracking()
                .Where(c => c.Id == targetId).Select(c => new { exists = true, c.Body, c.IsRemoved, deleted = c.DeletedAt != null, c.EditedAt }).FirstOrDefaultAsync()
                ?? (object)new { exists = false },
            _ => await _db.Items.AsNoTracking()
                .Where(i => i.Id == targetId).Select(i => new { exists = true, i.Description, i.Image, i.Quantity }).FirstOrDefaultAsync()
                ?? (object)new { exists = false },
        };

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
