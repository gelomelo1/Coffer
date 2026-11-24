using System.Text.Json;
using System.Text.Json.Serialization;
using Coffer.Domain.Marketplace;

namespace Coffer.BusinessLogic.DevSeed
{
    /// <summary>
    /// Shape of DEV_SEED_DATA_JSON (src/.env). Ids are fixed GUIDs so references are readable and resets
    /// are repeatable; times are offsets from "now" so the data always looks fresh. Enum values are snake_case
    /// strings exactly as the API uses them.
    /// </summary>
    public sealed class DevSeedData
    {
        public List<SeedUser> Users { get; set; } = new();
        public List<SeedCollection> Collections { get; set; } = new();
        public List<SeedItem> Items { get; set; } = new();
        public List<SeedFollow> Follows { get; set; } = new();
        public List<SeedReaction> Reactions { get; set; } = new();
        public List<SeedComment> Comments { get; set; } = new();
        public List<SeedCity> Cities { get; set; } = new();
        public List<SeedListing> Listings { get; set; } = new();
        public List<SeedConversation> Conversations { get; set; } = new();
        public List<SeedDeal> Deals { get; set; } = new();
        public List<SeedReview> Reviews { get; set; } = new();
        public List<SeedReport> Reports { get; set; } = new();
        public List<SeedSuspension> Suspensions { get; set; } = new();

        public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
        {
            ReadCommentHandling = JsonCommentHandling.Skip,
            AllowTrailingCommas = true,
            UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        };
    }

    public sealed class SeedUser
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = "";
        public string? Email { get; set; }
        /// <summary>
        /// "google", "facebook", "reddit" or "github". With the real provider id (Google/Facebook "sub", Reddit account
        /// id) the person can sign in to the app as this user; GitHub users (no longer an app sign-in) use the dev login.
        /// The seed is the only place a GitHub user may still be created.
        /// </summary>
        public string Provider { get; set; } = "google";
        public string ProviderUserId { get; set; } = "";
        public string Country { get; set; } = "HU";
        public string? Avatar { get; set; }
        public string? Summary { get; set; }
        public double CreatedDaysAgo { get; set; } = 60;
        public bool AcceptMarketTerms { get; set; } = true;
    }

    public sealed class SeedCollection
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        /// <summary>Only collection types with an AI model should be seeded (1 = Cap).</summary>
        public int CollectionTypeId { get; set; } = 1;
        public string Name { get; set; } = "";
        public string? Description { get; set; }
        public double CreatedDaysAgo { get; set; } = 30;
    }

    public sealed class SeedItem
    {
        public Guid Id { get; set; }
        public Guid CollectionId { get; set; }
        public string? Description { get; set; }
        public string? PrivateNote { get; set; }
        public int Quantity { get; set; } = 1;
        /// <summary>Raw photo file name in DEV_SEED_IMAGE_DIR; it goes through the AI pipeline (detect → crop → embed).</summary>
        public string Image { get; set; } = "";
        public double AcquiredDaysAgo { get; set; } = 10;
        public List<SeedItemAttribute> Attributes { get; set; } = new();
        public List<string> Tags { get; set; } = new();
    }

    /// <summary>Value as text; it is stored in the attribute's own column (string / number / date / boolean).</summary>
    public sealed class SeedItemAttribute
    {
        public int AttributeId { get; set; }
        public string Value { get; set; } = "";
    }

    public sealed class SeedFollow
    {
        public Guid UserId { get; set; }
        public Guid CollectionId { get; set; }
        public double DaysAgo { get; set; } = 5;
    }

    public sealed class SeedReaction
    {
        public Guid UserId { get; set; }
        public Guid ItemId { get; set; }
        public bool Liked { get; set; } = true;
        /// <summary>1–5 rarity vote, optional.</summary>
        public int? Rarity { get; set; }
    }

    public sealed class SeedComment
    {
        public Guid Id { get; set; }
        public Guid ItemId { get; set; }
        public Guid AuthorId { get; set; }
        public Guid? ParentId { get; set; }
        /// <summary>Plain text; mention users as "@Name" and list them in <see cref="Mentions"/>.</summary>
        public string Body { get; set; } = "";
        public List<Guid> Mentions { get; set; } = new();
        public double HoursAgo { get; set; } = 1;
        public bool Edited { get; set; }
        /// <summary>Deleted by its author (kept as a tombstone because it has replies or reports).</summary>
        public bool Deleted { get; set; }
    }

    /// <summary>A city for listings (GeoNames id + coordinates), upserted so seeding needs no network.</summary>
    public sealed class SeedCity
    {
        public long ExternalId { get; set; }
        public string Name { get; set; } = "";
        public string? Admin1 { get; set; }
        public string CountryCode { get; set; } = "HU";
        public double Latitude { get; set; }
        public double Longitude { get; set; }
    }

    public sealed class SeedListing
    {
        public Guid Id { get; set; }
        public Guid OwnerId { get; set; }
        public ListingKind Kind { get; set; }
        public int CollectionTypeId { get; set; } = 1;
        public string Title { get; set; } = "";
        public string? Description { get; set; }
        public int? PriceCents { get; set; }
        public string? ExchangeFor { get; set; }
        public ListingCondition? Condition { get; set; }
        public long CityExternalId { get; set; }
        public bool AllowsLocalPickup { get; set; } = true;
        public bool AllowsShipping { get; set; }
        /// <summary>Final status; must agree with the listing's deal (e.g. sold ⇔ completed deal).</summary>
        public ListingStatus Status { get; set; } = ListingStatus.Active;
        public List<SeedListingLine> Lines { get; set; } = new();
        /// <summary>Raw photo file names in DEV_SEED_IMAGE_DIR (at least one).</summary>
        public List<string> Images { get; set; } = new();
        public double CreatedDaysAgo { get; set; } = 7;
    }

    public sealed class SeedListingLine
    {
        public string Name { get; set; } = "";
        public int Quantity { get; set; } = 1;
    }

    public sealed class SeedConversation
    {
        public Guid Id { get; set; }
        public Guid ListingId { get; set; }
        /// <summary>The user who wrote to the listing owner.</summary>
        public Guid InquirerId { get; set; }
        public List<SeedMessage> Messages { get; set; } = new();
    }

    public sealed class SeedMessage
    {
        public Guid Id { get; set; }
        /// <summary>Null for a system message.</summary>
        public Guid? SenderId { get; set; }
        public MessageKind Kind { get; set; } = MessageKind.Text;
        public string Body { get; set; } = "";
        /// <summary>price_offer only.</summary>
        public int? AmountCents { get; set; }
        /// <summary>price_offer / meetup_proposal: pending, accepted, declined or withdrawn.</summary>
        public ProposalStatus? Status { get; set; }
        /// <summary>meetup_proposal only: hours from now (negative = in the past).</summary>
        public double? MeetupInHours { get; set; }
        public string? Place { get; set; }
        public double HoursAgo { get; set; } = 1;
    }

    public sealed class SeedDeal
    {
        public Guid Id { get; set; }
        public Guid ListingId { get; set; }
        public Guid ConversationId { get; set; }
        public Guid BuyerId { get; set; }
        public DeliveryMethod Method { get; set; }
        public DealStatus Status { get; set; }
        public int? AgreedPriceCents { get; set; }
        public double? MeetupInHours { get; set; }
        public string? MeetupPlace { get; set; }
        public string? Carrier { get; set; }
        public string? TrackingNumber { get; set; }
        public string? DisputeReason { get; set; }
        public string? CancelReason { get; set; }
        /// <summary>Who cancelled ("buyer" or "seller"), for cancelled deals.</summary>
        public string? CancelledBy { get; set; }
        public double CreatedDaysAgo { get; set; } = 3;
        /// <summary>When the last step happened (shipped / completed / disputed / cancelled).</summary>
        public double UpdatedDaysAgo { get; set; } = 1;
    }

    public sealed class SeedReview
    {
        public Guid Id { get; set; }
        public Guid DealId { get; set; }
        public Guid ReviewerId { get; set; }
        public int Stars { get; set; }
        public ReviewReasonTag? ReasonTag { get; set; }
        public string? Comment { get; set; }
        /// <summary>Published (visible) or still hidden until the other side reviews / the window ends.</summary>
        public bool Published { get; set; } = true;
        public string? Reply { get; set; }
    }

    public sealed class SeedReport
    {
        public Guid Id { get; set; }
        public Guid ReporterId { get; set; }
        public ReportTargetType TargetType { get; set; }
        public Guid TargetId { get; set; }
        public ReportRule Rule { get; set; }
        public string Reason { get; set; } = "";
        public double DaysAgo { get; set; } = 1;
        /// <summary>Set to resolve the report through the real moderation workflow after it is filed.</summary>
        public SeedResolution? Resolution { get; set; }
    }

    public sealed class SeedResolution
    {
        public ReportDecision Decision { get; set; }
        public string Statement { get; set; } = "";
        public int? SuspensionHours { get; set; }
    }

    public sealed class SeedSuspension
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public string Reason { get; set; } = "";
        public double StartedDaysAgo { get; set; }
        public double DurationHours { get; set; }
        public string? RevokeReason { get; set; }
        public double? RevokedDaysAgo { get; set; }
    }
}
