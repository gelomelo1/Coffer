using System.Text.Json;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.Domain.Marketplace;

namespace Coffer.BusinessLogic.Marketplace.Reports
{
    public record CreateReportInput(ReportTargetType TargetType, Guid TargetId, ReportRule Rule, string Reason);

    /// <summary>
    /// Resolution of one report (single-report endpoint). <paramref name="SuspensionHours"/> suspends the content
    /// author: required with <see cref="ReportDecision.Suspended"/>, optional with <see cref="ReportDecision.Removed"/>.
    /// </summary>
    public record ResolveReportInput(ReportDecision Decision, ReportRule? Rule, string? Statement, int? SuspensionHours = null);

    /// <summary>Several reports resolved together with one statement (stored on every report).</summary>
    public record ResolveReportsInput(List<Guid> ReportIds, ReportDecision Decision, ReportRule? Rule, string? Statement, int? SuspensionHours = null);

    /// <summary>All open reports on one piece of content.</summary>
    public record ResolveTargetInput(ReportDecision Decision, ReportRule? Rule, string? Statement, int? SuspensionHours = null);

    public record AppliedSuspensionDto(Guid UserId, string UserName, Guid SuspensionId, DateTime EndsAt, bool New);

    public record ResolveReportsResultDto(
        int ResolvedCount,
        List<Guid> ResolvedReportIds,
        int RemovedTargets,
        List<AppliedSuspensionDto> Suspensions,
        List<string> Notes);

    /// <summary>Picture that identifies the content in the admin lists ("listing" or "item" image store).</summary>
    public record ThumbnailDto(string Kind, string FileName);

    /// <summary>One reported piece of content with all its reports aggregated (Manager "Reported content" view).</summary>
    public record ReportedContentDto(
        ReportTargetType TargetType,
        Guid TargetId,
        string TargetSummary,
        ThumbnailDto? Thumbnail,
        UserSummaryDto Owner,
        int ReportCount,
        int OpenCount,
        List<ReportRule> Rules,
        List<UserSummaryDto> Reporters,
        Dictionary<string, int> Statuses,
        DateTime LatestReportAt,
        Guid? ListingId,
        Guid? ItemId,
        Guid? ConversationId);

    public record ReportedContentDetailDto(
        ReportedContentDto Content,
        List<AdminReportSummaryDto> Reports,
        int OwnerPriorRemovals,
        Coffer.BusinessLogic.Moderation.ActiveSuspensionDto? OwnerActiveSuspension,
        /// <summary>Evidence frozen by the most recent report.</summary>
        JsonElement LatestSnapshot,
        JsonElement CurrentState);

    public record ReportRuleDto(ReportRule Rule, string Label, string Description, ReportTargetType[] AppliesTo);

    /// <summary>A report as its author sees it (outcome included, as the DSA asks to inform the notifier).</summary>
    public record MyReportDto(
        Guid Id,
        ReportTargetType TargetType,
        Guid TargetId,
        Guid? ListingId,
        Guid? ConversationId,
        Guid? ItemId,
        string TargetSummary,
        ReportRule Rule,
        string Reason,
        ReportStatus Status,
        ReportDecision? Decision,
        string? Statement,
        DateTime CreatedAt,
        DateTime? ResolvedAt);

    /// <summary>Statement of reasons for removed content. Contains nothing about who reported it.</summary>
    public record ModerationActionDto(
        Guid Id,
        ReportTargetType TargetType,
        Guid TargetId,
        Guid? ListingId,
        Guid? ConversationId,
        Guid? ItemId,
        ReportRule Rule,
        string RuleLabel,
        string Statement,
        string ContentExcerpt,
        DateTime CreatedAt,
        bool Seen);

    public record AdminReportSummaryDto(
        Guid Id,
        ReportTargetType TargetType,
        Guid TargetId,
        ReportRule Rule,
        string Reason,
        string TargetSummary,
        ReportStatus Status,
        ReportDecision? Decision,
        UserSummaryDto Reporter,
        UserSummaryDto TargetOwner,
        DateTime CreatedAt,
        DateTime? ResolvedAt,
        string? Statement);

    public record AdminReportDto(
        Guid Id,
        ReportTargetType TargetType,
        Guid TargetId,
        Guid? ListingId,
        Guid? ConversationId,
        Guid? ItemId,
        ReportRule Rule,
        string Reason,
        string TargetSummary,
        ReportStatus Status,
        ReportDecision? Decision,
        string? Statement,
        Guid? SuspensionId,
        ThumbnailDto? Thumbnail,
        UserSummaryDto Reporter,
        UserSummaryDto TargetOwner,
        /// <summary>How many times the owner's content was removed before (context for the admin).</summary>
        int OwnerPriorRemovals,
        int OpenReportsOnTarget,
        Coffer.BusinessLogic.Moderation.ActiveSuspensionDto? OwnerActiveSuspension,
        /// <summary>Evidence frozen at report time.</summary>
        JsonElement Snapshot,
        /// <summary>The target as it is right now.</summary>
        JsonElement CurrentState,
        DateTime CreatedAt,
        DateTime? ResolvedAt);

    public static class ReportRules
    {
        private static readonly ReportTargetType[] All = Enum.GetValues<ReportTargetType>();
        private static readonly ReportTargetType[] Goods = { ReportTargetType.Listing, ReportTargetType.Message, ReportTargetType.Item };
        private static readonly ReportTargetType[] Scam = { ReportTargetType.Listing, ReportTargetType.Message, ReportTargetType.Comment };

        public static readonly IReadOnlyList<ReportRuleDto> List = new[]
        {
            new ReportRuleDto(ReportRule.IllegalItem, "Illegal or banned item",
                "Weapons, drugs, stolen goods, live animals or anything illegal to sell or show.", Goods),
            new ReportRuleDto(ReportRule.Counterfeit, "Counterfeit or replica",
                "A copy or replica offered or shown as an original.", Goods),
            new ReportRuleDto(ReportRule.ScamOrFraud, "Scam or fraud attempt",
                "Phishing, fake payment requests, asking for passwords or bank details.", Scam),
            new ReportRuleDto(ReportRule.Harassment, "Harassment, threats or hate",
                "Insults, threats, hate speech or sexual content.", All),
            new ReportRuleDto(ReportRule.PersonalData, "Someone's personal data",
                "Publishing addresses, phone numbers or documents of another person.", All),
            new ReportRuleDto(ReportRule.Spam, "Spam or advertising",
                "Repeated posts, ads for other services or links unrelated to the item.", All),
            new ReportRuleDto(ReportRule.FakeReview, "Fake or unrelated review",
                "A review that is about something other than this deal, or clearly invented.", new[] { ReportTargetType.Review }),
            new ReportRuleDto(ReportRule.OffTopic, "Off-topic",
                "Content that is not about a collectible item or the deal.",
                new[] { ReportTargetType.Listing, ReportTargetType.Review, ReportTargetType.Item, ReportTargetType.Comment }),
            new ReportRuleDto(ReportRule.Other, "Other rule break",
                "Breaks the Coffer rules in another way — explain in the reason.", All),
        };

        public static ReportRuleDto Get(ReportRule rule) => List.First(r => r.Rule == rule);

        public static bool Applies(ReportRule rule, ReportTargetType type) =>
            Enum.IsDefined(rule) && Get(rule).AppliesTo.Contains(type);
    }
}
