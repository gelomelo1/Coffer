using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.Domain.Marketplace;

namespace Coffer.BusinessLogic.Marketplace.Deals
{
    public record ProposeDealInput(Guid ConversationId, DeliveryMethod Method);
    public record ReasonInput(string? Reason);
    public record PinInput(string Pin);

    public record CarrierDto(string Code, string Label);

    public record DealDto(
        Guid Id,
        Guid ListingId,
        string ListingTitle,
        string? ListingImage,
        ListingKind ListingKind,
        Guid ConversationId,
        UserSummaryDto Seller,
        UserSummaryDto Buyer,
        ReviewerRole MyRole,
        DeliveryMethod Method,
        DealStatus Status,
        int? AgreedPriceCents,
        DateTime? MeetupAt,
        string? MeetupPlace,
        /// <summary>Only ever filled for the buyer.</summary>
        string? HandoffPin,
        /// <summary>QR content "coffer-handoff:{dealId}:{pin}", buyer only.</summary>
        string? HandoffQr,
        DateTime? PinLockedUntil,
        string? Carrier,
        string? CarrierLabel,
        string? TrackingNumber,
        string? TrackingUrl,
        string? ShipmentPhoto,
        DateTime? ShippedAt,
        DateTime? AutoCompleteAt,
        string? ReceiptPhoto,
        DateTime? ReceivedAt,
        DateTime? CompletedAt,
        CompletionReason? CompletionReason,
        DateTime? ReviewDeadline,
        string? DisputeReason,
        DateTime? DisputedAt,
        string? CancelReason,
        DateTime CreatedAt,
        DateTime UpdatedAt,
        /// <summary>What the viewer can do now: accept, decline, cancel, show_pin, enter_pin, ship, confirm_receipt, dispute, review.</summary>
        List<string> NextActions);

    public static class Carriers
    {
        private static readonly (string Code, string Label, string? Url)[] All =
        {
            ("magyar_posta", "Magyar Posta", "https://www.posta.hu/nyomkovetes/nyitooldal?searchvalue={0}"),
            ("gls", "GLS", "https://gls-group.com/HU/en/parcel-tracking?match={0}"),
            ("dpd", "DPD", "https://tracking.dpd.de/status/en_US/parcel/{0}"),
            ("foxpost", "Foxpost", "https://foxpost.hu/csomagkovetes/?code={0}"),
            ("packeta", "Packeta", "https://tracking.packeta.com/en/?id={0}"),
            ("dhl", "DHL", "https://www.dhl.com/hu-en/home/tracking.html?tracking-id={0}"),
            ("ups", "UPS", "https://www.ups.com/track?tracknum={0}"),
            ("other", "Other carrier", null),
        };

        public static IReadOnlyList<CarrierDto> List() => All.Select(c => new CarrierDto(c.Code, c.Label)).ToList();

        public static bool IsKnown(string? code) => All.Any(c => c.Code == code);

        public static string? Label(string? code) => All.FirstOrDefault(c => c.Code == code).Label;

        public static string? TrackingUrl(string? code, string? tracking)
        {
            var template = All.FirstOrDefault(c => c.Code == code).Url;
            return template == null || string.IsNullOrEmpty(tracking) ? null : string.Format(template, Uri.EscapeDataString(tracking));
        }
    }
}
