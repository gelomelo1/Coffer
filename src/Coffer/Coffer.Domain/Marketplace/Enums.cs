using System.Text.Json;
using System.Text.Json.Serialization;

namespace Coffer.Domain.Marketplace
{
    /// <summary>
    /// Serializes marketplace enums as snake_case strings ("pending_pickup") in the API.
    /// Applied per enum so the app's older enums keep their numeric JSON format.
    /// </summary>
    public sealed class SnakeCaseEnumJsonConverter<TEnum> : JsonStringEnumConverter<TEnum> where TEnum : struct, Enum
    {
        public SnakeCaseEnumJsonConverter() : base(JsonNamingPolicy.SnakeCaseLower, allowIntegerValues: false) { }
    }

    public static class EnumText
    {
        /// <summary>Single source of the snake_case text used both in JSON and in the database.</summary>
        public static string ToSnake<TEnum>(TEnum value) where TEnum : struct, Enum
            => JsonNamingPolicy.SnakeCaseLower.ConvertName(value.ToString());

        public static TEnum FromSnake<TEnum>(string text) where TEnum : struct, Enum
        {
            foreach (var value in Enum.GetValues<TEnum>())
                if (ToSnake(value) == text) return value;
            throw new ArgumentException($"'{text}' is not a valid {typeof(TEnum).Name}");
        }
    }

    [JsonConverter(typeof(SnakeCaseEnumJsonConverter<ListingKind>))]
    public enum ListingKind { Sell, Exchange, Wanted }

    [JsonConverter(typeof(SnakeCaseEnumJsonConverter<ListingCondition>))]
    public enum ListingCondition { New, LikeNew, Good, Fair, Poor }

    [JsonConverter(typeof(SnakeCaseEnumJsonConverter<ListingStatus>))]
    public enum ListingStatus { Active, PendingPickup, PendingShipment, Sold, Archived, Removed }

    [JsonConverter(typeof(SnakeCaseEnumJsonConverter<ParticipantRole>))]
    public enum ParticipantRole { Owner, Inquirer }

    [JsonConverter(typeof(SnakeCaseEnumJsonConverter<MessageKind>))]
    public enum MessageKind { Text, PriceOffer, MeetupProposal, System }

    [JsonConverter(typeof(SnakeCaseEnumJsonConverter<ProposalStatus>))]
    public enum ProposalStatus { Pending, Accepted, Declined, Withdrawn }

    [JsonConverter(typeof(SnakeCaseEnumJsonConverter<DeliveryMethod>))]
    public enum DeliveryMethod { LocalPickup, Shipping }

    [JsonConverter(typeof(SnakeCaseEnumJsonConverter<DealStatus>))]
    public enum DealStatus { Proposed, AwaitingHandoff, AwaitingShipment, Shipped, Completed, Disputed, Cancelled }

    [JsonConverter(typeof(SnakeCaseEnumJsonConverter<CompletionReason>))]
    public enum CompletionReason { HandoffVerified, ReceiptConfirmed, AutoCompleted, Moderator }

    [JsonConverter(typeof(SnakeCaseEnumJsonConverter<ReviewerRole>))]
    public enum ReviewerRole { Buyer, Seller }

    [JsonConverter(typeof(SnakeCaseEnumJsonConverter<ReviewReasonTag>))]
    public enum ReviewReasonTag
    {
        ItemNotAsDescribed, LateToMeetup, NoShow, PoorCommunication, DamagedInShipping,
        SlowShipping, PaymentProblem, RudeBehavior, Other
    }

    [JsonConverter(typeof(SnakeCaseEnumJsonConverter<ReportTargetType>))]
    public enum ReportTargetType { Listing, Message, Review, Item, Comment }

    /// <summary>The fixed content rules moderation enforces. Moderation never judges who was right in a deal.</summary>
    [JsonConverter(typeof(SnakeCaseEnumJsonConverter<ReportRule>))]
    public enum ReportRule { IllegalItem, Counterfeit, ScamOrFraud, Harassment, PersonalData, Spam, FakeReview, OffTopic, Other }

    [JsonConverter(typeof(SnakeCaseEnumJsonConverter<ReportStatus>))]
    public enum ReportStatus { Open, Resolved }

    [JsonConverter(typeof(SnakeCaseEnumJsonConverter<ReportDecision>))]
    public enum ReportDecision { Removed, NoViolation, Suspended }

    public static class DealStatuses
    {
        /// <summary>Deals that still hold the listing (one at a time per listing). Disputed is terminal.</summary>
        public static readonly DealStatus[] Open =
        {
            DealStatus.Proposed, DealStatus.AwaitingHandoff, DealStatus.AwaitingShipment, DealStatus.Shipped
        };

        public static bool IsOpen(DealStatus status) => Array.IndexOf(Open, status) >= 0;
    }
}
