using System.Text.Json;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.Domain.Marketplace;

namespace Coffer.BusinessLogic.Marketplace.Reports
{
    public record CreateReportInput(ReportTargetType TargetType, Guid TargetId, ReportRule Rule, string Reason);

    public record ResolveReportInput(ReportDecision Decision, ReportRule? Rule, string? Statement);

    public record ReportRuleDto(ReportRule Rule, string Label, string Description, ReportTargetType[] AppliesTo);

    /// <summary>A report as its author sees it (outcome included, as the DSA asks to inform the notifier).</summary>
    public record MyReportDto(
        Guid Id,
        ReportTargetType TargetType,
        Guid TargetId,
        Guid? ListingId,
        Guid? ConversationId,
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
        ReportRule Rule,
        string RuleLabel,
        string Statement,
        string ContentExcerpt,
        DateTime CreatedAt,
        bool Seen);

    public record AdminReportSummaryDto(
        Guid Id,
        ReportTargetType TargetType,
        ReportRule Rule,
        string Reason,
        string TargetSummary,
        ReportStatus Status,
        ReportDecision? Decision,
        UserSummaryDto Reporter,
        UserSummaryDto TargetOwner,
        DateTime CreatedAt);

    public record AdminReportDto(
        Guid Id,
        ReportTargetType TargetType,
        Guid TargetId,
        Guid? ListingId,
        Guid? ConversationId,
        ReportRule Rule,
        string Reason,
        string TargetSummary,
        ReportStatus Status,
        ReportDecision? Decision,
        string? Statement,
        UserSummaryDto Reporter,
        UserSummaryDto TargetOwner,
        /// <summary>How many times the owner's content was removed before (context for the admin).</summary>
        int OwnerPriorRemovals,
        int OpenReportsOnTarget,
        /// <summary>Evidence frozen at report time.</summary>
        JsonElement Snapshot,
        /// <summary>The target as it is right now.</summary>
        JsonElement CurrentState,
        DateTime CreatedAt,
        DateTime? ResolvedAt);

    public static class ReportRules
    {
        private static readonly ReportTargetType[] All = { ReportTargetType.Listing, ReportTargetType.Message, ReportTargetType.Review };
        private static readonly ReportTargetType[] ListingAndMessage = { ReportTargetType.Listing, ReportTargetType.Message };

        public static readonly IReadOnlyList<ReportRuleDto> List = new[]
        {
            new ReportRuleDto(ReportRule.IllegalItem, "Illegal or banned item",
                "Weapons, drugs, stolen goods, live animals or anything illegal to sell.", ListingAndMessage),
            new ReportRuleDto(ReportRule.Counterfeit, "Counterfeit or replica",
                "A copy or replica offered as an original.", ListingAndMessage),
            new ReportRuleDto(ReportRule.ScamOrFraud, "Scam or fraud attempt",
                "Phishing, fake payment requests, asking for passwords or bank details.", ListingAndMessage),
            new ReportRuleDto(ReportRule.Harassment, "Harassment, threats or hate",
                "Insults, threats, hate speech or sexual content.", All),
            new ReportRuleDto(ReportRule.PersonalData, "Someone's personal data",
                "Publishing addresses, phone numbers or documents of another person.", All),
            new ReportRuleDto(ReportRule.Spam, "Spam or advertising",
                "Repeated posts, ads for other services or links unrelated to the item.", All),
            new ReportRuleDto(ReportRule.FakeReview, "Fake or unrelated review",
                "A review that is about something other than this deal, or clearly invented.", new[] { ReportTargetType.Review }),
            new ReportRuleDto(ReportRule.OffTopic, "Off-topic",
                "Content that is not about a collectible item or the deal.", new[] { ReportTargetType.Listing, ReportTargetType.Review }),
            new ReportRuleDto(ReportRule.Other, "Other rule break",
                "Breaks the marketplace terms in another way — explain in the reason.", All),
        };

        public static ReportRuleDto Get(ReportRule rule) => List.First(r => r.Rule == rule);

        public static bool Applies(ReportRule rule, ReportTargetType type) =>
            Enum.IsDefined(rule) && Get(rule).AppliesTo.Contains(type);
    }
}
