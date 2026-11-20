using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.Domain.Marketplace;

namespace Coffer.BusinessLogic.Marketplace.Messaging
{
    public record PostMessageInput(MessageKind Kind, string? Body, int? AmountCents, DateTime? At, string? Place);

    public record RespondInput(string Action);

    /// <summary>What a conversation is about, in subject-neutral terms (a listing today, maybe an item later).</summary>
    /// <summary>What a chat is about. IsDeleted: the listing went with its owner's account (no title, no image).</summary>
    public record SubjectSummaryDto(Guid Id, string Type, string Title, string? Image, string? Status, string? Kind, int? PriceCents, bool IsDeleted = false);

    public record MessageDto(
        Guid Id,
        Guid? SenderId,
        MessageKind Kind,
        string Body,
        int? AmountCents,
        DateTime? At,
        string? Place,
        ProposalStatus? Status,
        /// <summary>Removed by moderation: body is replaced, proposal details are hidden.</summary>
        bool IsRemoved,
        DateTime CreatedAt,
        /// <summary>System messages: what happened (market:system.&lt;code&gt; in the app) and its values; Body is the English text.</summary>
        string? SystemCode = null,
        IReadOnlyDictionary<string, string>? SystemParams = null);

    public record ConversationDto(
        Guid Id,
        SubjectSummaryDto Subject,
        ParticipantRole MyRole,
        UserSummaryDto Other,
        int? AgreedPriceCents,
        Guid? OpenDealId,
        DateTime LastMessageAt,
        /// <summary>The newest deal of this chat in any state (the deal panel shows it, open or closed).</summary>
        Guid? LatestDealId = null);

    /// <summary>A page of a chat, oldest → newest. Older pages are asked with before = the oldest loaded message's time.</summary>
    public record MessagePageDto(List<MessageDto> Items, bool HasMore, int Total);

    /// <summary>Counts for the marketplace tab badges.</summary>
    public record MarketBadgesDto(int UnreadMessages, int ActionableDeals);

    public record ConversationSummaryDto(
        Guid Id,
        SubjectSummaryDto Subject,
        ParticipantRole MyRole,
        UserSummaryDto Other,
        string? LastMessagePreview,
        DateTime LastMessageAt,
        int UnreadCount,
        /// <summary>The last message itself, so the app can show the preview in the user's language.</summary>
        MessageDto? LastMessage = null);

    /// <summary>JSON stored in messages.payload for proposals.</summary>
    internal sealed class ProposalPayload
    {
        public int? AmountCents { get; set; }
        public DateTime? At { get; set; }
        public string? Place { get; set; }
        public ProposalStatus Status { get; set; }
        /// <summary>System messages: a language-neutral code + params next to the English body.</summary>
        public string? Code { get; set; }
        public Dictionary<string, string>? Params { get; set; }
    }
}
