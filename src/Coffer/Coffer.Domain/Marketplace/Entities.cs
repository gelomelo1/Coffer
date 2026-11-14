using System.Text.Json.Serialization;
using Coffer.Domain.Entities;

namespace Coffer.Domain.Marketplace
{
    public class City
    {
        public int Id { get; set; }
        public long ExternalId { get; set; }
        public string Name { get; set; } = "";
        public string? Admin1 { get; set; }
        public string CountryCode { get; set; } = "";
        public double Latitude { get; set; }
        public double Longitude { get; set; }
    }

    public class Listing
    {
        public Guid Id { get; set; }
        public Guid OwnerId { get; set; }
        public User Owner { get; set; } = null!;
        public ListingKind Kind { get; set; }
        public int CollectionTypeId { get; set; }
        public CollectionTypeProvided CollectionType { get; set; } = null!;
        public string Title { get; set; } = "";
        public string? Description { get; set; }
        public int? PriceCents { get; set; }
        public string Currency { get; set; } = "EUR";
        public string? ExchangeFor { get; set; }
        public ListingCondition? Condition { get; set; }
        public int CityId { get; set; }
        public City City { get; set; } = null!;
        public bool AllowsLocalPickup { get; set; }
        public bool AllowsShipping { get; set; }
        /// <summary>Seller confirmed they sell as a private person (C2C only).</summary>
        public bool PrivateSellerDeclared { get; set; }
        public ListingStatus Status { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public List<ListingLine> Lines { get; set; } = new();
        public List<ListingImage> Images { get; set; } = new();
    }

    public class ListingLine
    {
        public Guid Id { get; set; }
        public Guid ListingId { get; set; }
        public string Name { get; set; } = "";
        public int Quantity { get; set; }
        public int Position { get; set; }
    }

    public class ListingImage
    {
        public Guid Id { get; set; }
        public Guid ListingId { get; set; }
        public string FileName { get; set; } = "";
        public int Position { get; set; }
    }

    /// <summary>
    /// Generic conversation about any subject (subject_type + subject_id). Marketplace uses subject_type "listing";
    /// other features (e.g. item comments) can plug in their own subject policy later.
    /// </summary>
    public class Conversation
    {
        public Guid Id { get; set; }
        public string SubjectType { get; set; } = "";
        public Guid SubjectId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime LastMessageAt { get; set; }
        /// <summary>When the subject owner first answered (responsiveness metric).</summary>
        public DateTime? OwnerFirstResponseAt { get; set; }
        public int? AgreedPriceCents { get; set; }
        public List<ConversationParticipant> Participants { get; set; } = new();
        public List<Message> Messages { get; set; } = new();
    }

    public class ConversationParticipant
    {
        public Guid ConversationId { get; set; }
        public Guid UserId { get; set; }
        public User User { get; set; } = null!;
        public ParticipantRole Role { get; set; }
        public DateTime? LastReadAt { get; set; }
        public DateTime JoinedAt { get; set; }
    }

    public class Message
    {
        public Guid Id { get; set; }
        public Guid ConversationId { get; set; }
        /// <summary>Null for system messages.</summary>
        public Guid? SenderId { get; set; }
        public User? Sender { get; set; }
        public MessageKind Kind { get; set; }
        public string Body { get; set; } = "";
        /// <summary>JSON: price_offer {amountCents,status}; meetup_proposal {at,place,status}.</summary>
        public string? Payload { get; set; }
        /// <summary>Removed by an admin for breaking a content rule; content is masked in every read.</summary>
        public bool IsRemoved { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    /// <summary>A transaction between a seller and a buyer for one listing.</summary>
    public class Deal
    {
        public Guid Id { get; set; }
        public Guid ListingId { get; set; }
        public Listing Listing { get; set; } = null!;
        public Guid ConversationId { get; set; }
        public Guid SellerId { get; set; }
        public User Seller { get; set; } = null!;
        public Guid BuyerId { get; set; }
        public User Buyer { get; set; } = null!;
        public DeliveryMethod Method { get; set; }
        public DealStatus Status { get; set; }
        public int? AgreedPriceCents { get; set; }
        public DateTime? MeetupAt { get; set; }
        public string? MeetupPlace { get; set; }
        [JsonIgnore]
        public string? HandoffPin { get; set; }
        public int PinFailedAttempts { get; set; }
        public DateTime? PinLockedUntil { get; set; }
        public string? Carrier { get; set; }
        public string? TrackingNumber { get; set; }
        public string? ShipmentPhoto { get; set; }
        public DateTime? ShippedAt { get; set; }
        public string? ReceiptPhoto { get; set; }
        public DateTime? ReceivedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public CompletionReason? CompletionReason { get; set; }
        public DateTime? ReviewDeadline { get; set; }
        public string? DisputeReason { get; set; }
        public DateTime? DisputedAt { get; set; }
        public Guid? CancelledBy { get; set; }
        public string? CancelReason { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class Review
    {
        public Guid Id { get; set; }
        public Guid DealId { get; set; }
        public Deal Deal { get; set; } = null!;
        public Guid? ReviewerId { get; set; }
        public User? Reviewer { get; set; }
        public Guid RevieweeId { get; set; }
        public User Reviewee { get; set; } = null!;
        public ReviewerRole ReviewerRole { get; set; }
        public int Stars { get; set; }
        public ReviewReasonTag? ReasonTag { get; set; }
        public string? Comment { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? PublishedAt { get; set; }
        public string? Reply { get; set; }
        public DateTime? RepliedAt { get; set; }
        public bool IsFrozen { get; set; }
        public bool IsRemoved { get; set; }
    }

    /// <summary>A user's notice that a listing, message or review breaks a content rule (notice &amp; action).</summary>
    public class Report
    {
        public Guid Id { get; set; }
        public Guid ReporterId { get; set; }
        public ReportTargetType TargetType { get; set; }
        public Guid TargetId { get; set; }
        /// <summary>Author of the reported content.</summary>
        public Guid TargetOwnerId { get; set; }
        /// <summary>Navigation context: the listing / conversation the content belongs to.</summary>
        public Guid? ListingId { get; set; }
        public Guid? ConversationId { get; set; }
        /// <summary>Short human-readable description of the target (listing title, message excerpt, …).</summary>
        public string TargetSummary { get; set; } = "";
        public ReportRule Rule { get; set; }
        public string Reason { get; set; } = "";
        /// <summary>JSON evidence frozen when the report was made (content + context).</summary>
        public string Snapshot { get; set; } = "{}";
        public ReportStatus Status { get; set; }
        public ReportDecision? Decision { get; set; }
        /// <summary>The admin's statement of reasons.</summary>
        public string? Statement { get; set; }
        public Guid? ResolvedBy { get; set; }
        public DateTime? ResolvedAt { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    /// <summary>
    /// Statement of reasons shown to the author of removed content. Deliberately not linked to the report,
    /// so the reporter is never revealed.
    /// </summary>
    public class ModerationAction
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public ReportTargetType TargetType { get; set; }
        public Guid TargetId { get; set; }
        public Guid? ListingId { get; set; }
        public Guid? ConversationId { get; set; }
        public ReportRule Rule { get; set; }
        public string Statement { get; set; } = "";
        public string ContentExcerpt { get; set; } = "";
        public DateTime CreatedAt { get; set; }
        public DateTime? SeenAt { get; set; }
    }
}
