using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.Domain.Marketplace;

namespace Coffer.BusinessLogic.Marketplace.Messaging
{
    public record PostMessageInput(MessageKind Kind, string? Body, int? AmountCents, DateTime? At, string? Place);

    public record RespondInput(string Action);

    /// <summary>What a conversation is about, in subject-neutral terms (a listing today, maybe an item later).</summary>
    public record SubjectSummaryDto(Guid Id, string Type, string Title, string? Image, string? Status, string? Kind, int? PriceCents);

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
        DateTime CreatedAt);

    public record ConversationDto(
        Guid Id,
        SubjectSummaryDto Subject,
        ParticipantRole MyRole,
        UserSummaryDto Other,
        int? AgreedPriceCents,
        Guid? OpenDealId,
        DateTime LastMessageAt);

    public record ConversationSummaryDto(
        Guid Id,
        SubjectSummaryDto Subject,
        ParticipantRole MyRole,
        UserSummaryDto Other,
        string? LastMessagePreview,
        DateTime LastMessageAt,
        int UnreadCount);

    /// <summary>JSON stored in messages.payload for proposals.</summary>
    internal sealed class ProposalPayload
    {
        public int? AmountCents { get; set; }
        public DateTime? At { get; set; }
        public string? Place { get; set; }
        public ProposalStatus Status { get; set; }
    }
}
