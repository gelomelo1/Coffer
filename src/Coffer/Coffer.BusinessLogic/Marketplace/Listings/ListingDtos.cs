using Coffer.BusinessLogic.Marketplace.Cities;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.Domain.Marketplace;

namespace Coffer.BusinessLogic.Marketplace.Listings
{
    public record ListingLineInput(string Name, int Quantity);

    public record ListingInput(
        ListingKind Kind,
        int CollectionTypeId,
        string Title,
        string? Description,
        int? PriceCents,
        string? ExchangeFor,
        ListingCondition? Condition,
        int CityId,
        bool AllowsLocalPickup,
        bool AllowsShipping,
        List<ListingLineInput> Lines,
        List<Guid>? KeepImageIds,
        /// <summary>"I'm selling as a private person" — required for sell/exchange.</summary>
        bool PrivateSellerDeclared = false);

    public class ListingQuery
    {
        public ListingKind? Kind { get; set; }
        public int? CollectionTypeId { get; set; }
        public int? CityId { get; set; }
        public double? RadiusKm { get; set; }
        public int? MinPriceCents { get; set; }
        public int? MaxPriceCents { get; set; }
        public ListingCondition? Condition { get; set; }
        public DeliveryMethod? Delivery { get; set; }
        /// <summary>Seller nationality: ISO 3166-1 alpha-2 country codes of the seller's profile (any of them).</summary>
        public List<string> SellerCountries { get; set; } = new();
        /// <summary>nearest | price_asc | price_desc | newest (default)</summary>
        public string? Sort { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }

    public record ListingLineDto(string Name, int Quantity);
    public record ListingImageDto(Guid Id, string FileName);

    public record ListingSummaryDto(
        Guid Id,
        ListingKind Kind,
        ListingStatus Status,
        string Title,
        int? PriceCents,
        string Currency,
        string? ExchangeFor,
        ListingCondition? Condition,
        int CollectionTypeId,
        string CollectionTypeName,
        string CollectionTypeColor,
        int CityId,
        string CityName,
        double? DistanceKm,
        string? FirstImage,
        bool AllowsLocalPickup,
        bool AllowsShipping,
        bool PrivateSellerDeclared,
        DateTime CreatedAt,
        UserSummaryDto Owner,
        /// <summary>Seller's country (ISO alpha-2, from their profile).</summary>
        string? SellerCountry = null);

    public record ListingDetailDto(
        Guid Id,
        ListingKind Kind,
        ListingStatus Status,
        string Title,
        string? Description,
        int? PriceCents,
        string Currency,
        string? ExchangeFor,
        ListingCondition? Condition,
        int CollectionTypeId,
        string CollectionTypeName,
        string CollectionTypeColor,
        CityDto City,
        bool AllowsLocalPickup,
        bool AllowsShipping,
        bool PrivateSellerDeclared,
        List<ListingLineDto> Lines,
        List<ListingImageDto> Images,
        DateTime CreatedAt,
        DateTime UpdatedAt,
        UserSummaryDto Owner,
        bool IsMine,
        Guid? MyConversationId,
        Guid? OpenDealId);
}
